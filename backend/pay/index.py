"""Создание платежа ЮКасса через СБП и вебхук подтверждения оплаты."""
import json
import os
import uuid
import psycopg2
import urllib.request

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
}

PACKAGE_CREDITS = 100
PACKAGE_AMOUNT = 10000.00

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def schema():
    return os.environ.get('MAIN_DB_SCHEMA', 't_p14707447_client_finder_ai')

def ok(data: dict):
    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(data, ensure_ascii=False, default=str)}

def err(msg: str, code=400):
    return {'statusCode': code, 'headers': CORS, 'body': json.dumps({'error': msg}, ensure_ascii=False)}

def get_user_by_session(cur, session_id: str, s: str):
    cur.execute(
        f'SELECT u.id, u.email FROM {s}.users u JOIN {s}.sessions sess ON sess.user_id = u.id WHERE sess.id = %s AND sess.expires_at > NOW()',
        (session_id,)
    )
    return cur.fetchone()

def yookassa_create_payment(shop_id: str, api_key: str, amount: float, user_email: str, payment_id: int, return_url: str) -> dict:
    payload = {
        'amount': {'value': f'{amount:.2f}', 'currency': 'RUB'},
        'payment_method_data': {'type': 'sbp'},
        'confirmation': {'type': 'redirect', 'return_url': return_url},
        'capture': True,
        'description': f'ЭК5 — пакет 100 выгрузок (платёж #{payment_id})',
        'receipt': {
            'customer': {'email': user_email},
            'items': [{
                'description': 'Пакет 100 выгрузок из ЭК5',
                'quantity': '1.00',
                'amount': {'value': f'{amount:.2f}', 'currency': 'RUB'},
                'vat_code': 1,
                'payment_mode': 'full_payment',
                'payment_subject': 'service',
            }]
        }
    }
    idempotence = str(uuid.uuid4())
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        'https://api.yookassa.ru/v3/payments',
        data=data,
        headers={
            'Content-Type': 'application/json',
            'Idempotence-Key': idempotence,
        },
        method='POST'
    )
    import base64
    creds = base64.b64encode(f'{shop_id}:{api_key}'.encode()).decode()
    req.add_header('Authorization', f'Basic {creds}')
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())

def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    body = json.loads(event.get('body') or '{}')
    action = body.get('action')
    s = schema()
    conn = get_conn()
    cur = conn.cursor()

    try:
        # --- Создание платежа ---
        if action == 'create':
            session_id = (event.get('headers') or {}).get('X-Session-Id') or body.get('session_id')
            if not session_id:
                return err('Не авторизован', 401)
            row = get_user_by_session(cur, session_id, s)
            if not row:
                return err('Сессия истекла', 401)
            user_id, user_email = row

            shop_id = os.environ['YOOKASSA_SHOP_ID']
            api_key = os.environ['YOOKASSA_API_KEY']
            return_url = os.environ.get('APP_URL', 'https://poehali.dev') + '/cabinet'

            # Создаём запись платежа
            cur.execute(
                f'INSERT INTO {s}.payments (user_id, amount, credits, status) VALUES (%s, %s, %s, %s) RETURNING id',
                (user_id, PACKAGE_AMOUNT, PACKAGE_CREDITS, 'pending')
            )
            payment_db_id = cur.fetchone()[0]
            conn.commit()

            # Создаём платёж в ЮКассе
            yk = yookassa_create_payment(shop_id, api_key, PACKAGE_AMOUNT, user_email, payment_db_id, return_url)
            yk_id = yk.get('id')
            sbp_url = yk.get('confirmation', {}).get('confirmation_url') or yk.get('confirmation', {}).get('confirmation_data')

            cur.execute(
                f"UPDATE {s}.payments SET yookassa_id = %s, sbp_url = %s WHERE id = %s",
                (yk_id, sbp_url, payment_db_id)
            )
            conn.commit()

            return ok({'payment_id': payment_db_id, 'sbp_url': sbp_url, 'amount': PACKAGE_AMOUNT, 'credits': PACKAGE_CREDITS})

        # --- Вебхук от ЮКассы ---
        elif action is None and body.get('type') == 'notification':
            obj = body.get('object', {})
            yk_id = obj.get('id')
            status = obj.get('status')
            if status != 'succeeded' or not yk_id:
                return ok({'ok': True})

            cur.execute(f"SELECT id, user_id, credits, status FROM {s}.payments WHERE yookassa_id = %s", (yk_id,))
            row = cur.fetchone()
            if not row:
                return ok({'ok': True})
            pay_id, user_id, credits, pay_status = row
            if pay_status == 'succeeded':
                return ok({'ok': True})

            cur.execute(
                f"UPDATE {s}.payments SET status = 'succeeded', confirmed_at = NOW() WHERE id = %s",
                (pay_id,)
            )
            cur.execute(
                f"UPDATE {s}.users SET credits = credits + %s WHERE id = %s",
                (credits, user_id)
            )
            cur.execute(
                f"INSERT INTO {s}.credit_log (user_id, delta, reason) VALUES (%s, %s, %s)",
                (user_id, credits, f'Пополнение через СБП (платёж #{pay_id})')
            )
            conn.commit()
            return ok({'ok': True})

        # --- Проверка статуса платежа ---
        elif action == 'check':
            payment_id = body.get('payment_id')
            session_id = (event.get('headers') or {}).get('X-Session-Id') or body.get('session_id')
            row = get_user_by_session(cur, session_id, s)
            if not row:
                return err('Не авторизован', 401)
            user_id = row[0]
            cur.execute(
                f"SELECT status, credits FROM {s}.payments WHERE id = %s AND user_id = %s",
                (payment_id, user_id)
            )
            p = cur.fetchone()
            if not p:
                return err('Платёж не найден', 404)
            # Обновлённый баланс
            cur.execute(f"SELECT credits FROM {s}.users WHERE id = %s", (user_id,))
            balance = cur.fetchone()[0]
            return ok({'status': p[0], 'credits_added': p[1], 'balance': balance})

        return err('Неизвестное действие')
    finally:
        cur.close()
        conn.close()
