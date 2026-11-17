FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PORT=9999 LOCAL_IDENTITY_DATA=/data
COPY server.py .
RUN useradd --system --uid 10001 identity && mkdir /data && chown identity /data
USER identity
VOLUME /data
CMD ["python", "server.py"]
