# Image du service rh.
#
# Le contexte de construction est la RACINE du depot : l'image a besoin de
# « libs/gdahub_common », partage par tous les services.
#
#   docker build -f services/rh/Dockerfile --target developpement .

FROM python:3.13-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY libs/gdahub_common /libs/gdahub_common
COPY services/rh/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir -e /libs/gdahub_common

COPY services/rh/ /app/
RUN chmod +x /app/entrypoint.sh

EXPOSE 8000

FROM base AS developpement
ENV DJANGO_DEBUG=True
CMD ["/app/entrypoint.sh"]

FROM base AS production
ENV DJANGO_DEBUG=False
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]
