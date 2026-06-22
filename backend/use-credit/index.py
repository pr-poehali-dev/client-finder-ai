"""Списание одной выгрузки с баланса пользователя при экспорте."""
import json
import os
import psycopg2

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
}

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def schema():
    return os.environ.get('MAIN_DB_SCHEMA', 't_p14707447_client_finder_ai')

def ok(data: dict):
    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(data, ensure_ascii=False)}

def err(msg: str, code=400):
    return {'statusCode': code, 'headers': CORS, 'body': json.dumps({'error': msg}, ensure_ascii=False)}

def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    session_id = (event.get('headers') or {}).get('X-Session-Id')
    if not session_id:
        return err('Не авторизован', 401)

    body = json.loads(event.get('body') or '{}')
    reason = body.get('reason', 'Экспорт выгрузки')

    s = schema()
    conn = get_conn()
    cur = conn.cursor()

    try:
        cur.execute(
            f'SELECT u.id, u.credits FROM {s}.users u JOIN {s}.sessions sess ON sess.user_id = u.id WHERE sess.id = %s AND sess.expires_at > NOW()',
            (session_id,)
        )
        row = cur.fetchone()
        if not row:
            return err('Сессия истекла', 401)
        user_id, credits = row

        if credits <= 0:
            return err('Недостаточно выгрузок. Пополните баланс.', 402)

        cur.execute(
            f'UPDATE {s}.users SET credits = credits - 1 WHERE id = %s AND credits > 0 RETURNING credits',
            (user_id,)
        )
        updated = cur.fetchone()
        if not updated:
            return err('Недостаточно выгрузок. Пополните баланс.', 402)
        new_credits = updated[0]

        cur.execute(
            f'INSERT INTO {s}.credit_log (user_id, delta, reason) VALUES (%s, %s, %s)',
            (user_id, -1, reason)
        )
        conn.commit()
        return ok({'ok': True, 'credits': new_credits})
    finally:
        cur.close()
        conn.close()
