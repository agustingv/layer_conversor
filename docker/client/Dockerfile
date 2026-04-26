FROM node:22-alpine

WORKDIR /app

EXPOSE 3000

CMD ["sh", "-c", "[ -f package.json ] && npm install && npm run dev || echo 'Run: make install-client'"]
