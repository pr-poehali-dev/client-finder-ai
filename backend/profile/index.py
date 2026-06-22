"""Личный кабинет: баланс пользователя и история операций с выгрузками."""
import json
import os
import psycopg2

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
}

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def schema():
    return os.environ.get('MAIN_DB_SCHEMA', 't_p14707447_client_finder_ai')

def get_user(cur, session_id: str, s: str):
    cur.execute(
        f'SELECT u.id, u.email, u.full_name, u.credits FROM {s}.users u JOIN {s}.sessions sess ON sess.user_id = u.id WHERE sess.id = %s AND sess.expires_at > NOW()',
        (session_id,)
    )
    return cur.fetchone()

def ok(data: dict):
    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(data, ensure_ascii=False, default=str)}

def err(msg: str, code=400):
    return {'statusCode': code, 'headers': CORS, 'body': json.dumps({'error': msg}, ensure_ascii=False)}

def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    session_id = (event.get('headers') or {}).get('X-Session-Id')
    if not session_id:
        return err('Не авторизован', 401)

    s = schema()
    conn = get_conn()
    cur = conn.cursor()

    try:
        row = get_user(cur, session_id, s)
        if not row:
            return err('Сессия истекла', 401)
        user_id, email, full_name, credits = row

        # История операций
        cur.execute(
            f"SELECT delta, reason, created_at FROM {s}.credit_log WHERE user_id = %s ORDER BY created_at DESC LIMIT 50",
            (user_id,)
        )
        log_rows = cur.fetchall()
        history = [{'delta': r[0], 'reason': r[1], 'created_at': str(r[2])} for r in log_rows]

        # История платежей
        cur.execute(
            f"SELECT amount, credits, status, created_at, confirmed_at FROM {s}.payments WHERE user_id = %s ORDER BY created_at DESC LIMIT 20",
            (user_id,)
        )
        pay_rows = cur.fetchall()
        payments = [{'amount': float(r[0]), 'credits': r[1], 'status': r[2], 'created_at': str(r[3]), 'confirmed_at': str(r[4]) if r[4] else None} for r in pay_rows]

        return ok({
            'user': {'id': user_id, 'email': email, 'full_name': full_name, 'credits': credits},
            'history': history,
            'payments': payments,
        })
    finally:
        cur.close()
        conn.close()
