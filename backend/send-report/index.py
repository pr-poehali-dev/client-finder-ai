"""Отправка отчёта по клиентам ЭК5 на email менеджера с xlsx-вложением."""
import json
import os
import smtplib
import base64
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.text import MIMEText
from email import encoders


CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    body = json.loads(event.get('body') or '{}')
    to_email = (body.get('email') or '').strip()
    filename = (body.get('filename') or 'clients.xlsx').strip()
    file_b64 = body.get('file')
    client_count = int(body.get('count') or 0)

    if not to_email or not file_b64:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Укажите email и файл'})}

    smtp_host = os.environ['SMTP_HOST']
    smtp_port = int(os.environ['SMTP_PORT'])
    smtp_user = os.environ['SMTP_USER']
    smtp_password = os.environ['SMTP_PASSWORD']

    msg = MIMEMultipart()
    msg['From'] = f'ЭК5 Аналитика <{smtp_user}>'
    msg['To'] = to_email
    msg['Subject'] = f'ЭК5 — новые клиенты ({client_count} шт.)'

    body_text = (
        f'Добрый день!\n\n'
        f'Во вложении — список клиентов со стажем работы до 3 месяцев ({client_count} шт.).\n'
        f'Файл сформирован автоматически системой ЭК5 Аналитика.\n\n'
        f'С уважением,\nЭК5 Аналитика'
    )
    msg.attach(MIMEText(body_text, 'plain', 'utf-8'))

    file_bytes = base64.b64decode(file_b64)
    part = MIMEBase('application', 'vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    part.set_payload(file_bytes)
    encoders.encode_base64(part)
    part.add_header('Content-Disposition', f'attachment; filename="{filename}"')
    msg.attach(part)

    with smtplib.SMTP_SSL(smtp_host, smtp_port) as server:
        server.login(smtp_user, smtp_password)
        server.sendmail(smtp_user, to_email, msg.as_string())

    return {
        'statusCode': 200,
        'headers': CORS,
        'body': json.dumps({'ok': True, 'message': f'Письмо отправлено на {to_email}'}),
    }
