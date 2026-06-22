"""Регистрация, вход и выход пользователей. Управление сессиями."""
import json
import os
import hashlib
import secrets
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

def hash_password(pwd: str) -> str:
    return hashlib.sha256(pwd.encode()).hexdigest()

def ok(data: dict):
    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(data, ensure_ascii=False)}

def err(msg: str, code=400):
    return {'statusCode': code, 'headers': CORS, 'body': json.dumps({'error': msg}, ensure_ascii=False)}

def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    body = json.loads(event.get('body') or '{}')
    action = body.get('action')
    s = schema()

    conn = get_conn()
    cur = conn.cursor()

    try:
        if action == 'register':
            email = (body.get('email') or '').strip().lower()
            password = body.get('password') or ''
            full_name = (body.get('full_name') or '').strip()
            if not email or not password:
                return err('Укажите email и пароль')
            if len(password) < 6:
                return err('Пароль должен быть не менее 6 символов')
            cur.execute(f'SELECT id FROM {s}.users WHERE email = %s', (email,))
            if cur.fetchone():
                return err('Пользователь с таким email уже существует')
            cur.execute(
                f'INSERT INTO {s}.users (email, password_hash, full_name) VALUES (%s, %s, %s) RETURNING id',
                (email, hash_password(password), full_name)
            )
            user_id = cur.fetchone()[0]
            session_id = secrets.token_hex(32)
            cur.execute(
                f'INSERT INTO {s}.sessions (id, user_id) VALUES (%s, %s)',
                (session_id, user_id)
            )
            conn.commit()
            return ok({'session_id': session_id, 'user': {'id': user_id, 'email': email, 'full_name': full_name, 'credits': 0}})

        elif action == 'login':
            email = (body.get('email') or '').strip().lower()
            password = body.get('password') or ''
            cur.execute(f'SELECT id, email, full_name, credits FROM {s}.users WHERE email = %s AND password_hash = %s AND is_active = TRUE',
                        (email, hash_password(password)))
            row = cur.fetchone()
            if not row:
                return err('Неверный email или пароль', 401)
            user_id, email, full_name, credits = row
            session_id = secrets.token_hex(32)
            cur.execute(f'INSERT INTO {s}.sessions (id, user_id) VALUES (%s, %s)', (session_id, user_id))
            conn.commit()
            return ok({'session_id': session_id, 'user': {'id': user_id, 'email': email, 'full_name': full_name, 'credits': credits}})

        elif action == 'logout':
            session_id = (event.get('headers') or {}).get('X-Session-Id') or body.get('session_id')
            if session_id:
                cur.execute(f"UPDATE {s}.sessions SET expires_at = NOW() WHERE id = %s", (session_id,))
                conn.commit()
            return ok({'ok': True})

        elif action == 'me':
            session_id = (event.get('headers') or {}).get('X-Session-Id') or body.get('session_id')
            if not session_id:
                return err('Не авторизован', 401)
            cur.execute(
                f'SELECT u.id, u.email, u.full_name, u.credits FROM {s}.users u JOIN {s}.sessions s ON s.user_id = u.id WHERE s.id = %s AND s.expires_at > NOW()',
                (session_id,)
            )
            row = cur.fetchone()
            if not row:
                return err('Сессия истекла', 401)
            user_id, email, full_name, credits = row
            return ok({'user': {'id': user_id, 'email': email, 'full_name': full_name, 'credits': credits}})

        return err('Неизвестное действие')
    finally:
        cur.close()
        conn.close()
