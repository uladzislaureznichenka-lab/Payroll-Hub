# Деплой Payroll Hub в интернет

## Быстрый способ (ngrok) — для тестов и демо

1. Установите ngrok: `brew install ngrok` (или с [ngrok.com](https://ngrok.com))
2. Запустите backend: `cd backend && python run.py`
3. Запустите frontend: `cd frontend && npm run dev`
4. В новом терминале: `ngrok http 5173`
5. Скопируйте ссылку (например `https://abc123.ngrok-free.app`) — её можно открыть из интернета

---

## Продакшен: один сервер (VPS)

### 1. Подготовка

```bash
# Backend
cd backend
pip install -r requirements.txt gunicorn

# Frontend — собрать статику
cd frontend
npm run build
```

### 2. Nginx (пример конфига)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend (статика)
    root /path/to/payroll-hub/frontend/dist;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API → Flask
    location /api {
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Запуск backend

```bash
cd backend
gunicorn -w 4 -b 127.0.0.1:5001 "app:create_app()"
```

Или через systemd/supervisor для автозапуска.

### 4. HTTPS (Let's Encrypt)

```bash
sudo certbot --nginx -d your-domain.com
```

---

## Альтернатива: Railway / Render

- **Railway**: [railway.app](https://railway.app) — деплой из GitHub, авто-деплой
- **Render**: [render.com](https://render.com) — бесплатный тариф для backend и static site

Для обоих: backend как Web Service, frontend как Static Site. В frontend задайте переменную `VITE_API_URL` на URL backend (если API на другом домене).
