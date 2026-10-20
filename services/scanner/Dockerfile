FROM python:3.12.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN addgroup --system scanner && adduser --system --ingroup scanner scanner
COPY pyproject.toml ./
RUN --mount=type=cache,target=/root/.cache/pip pip install .
COPY scanner scanner
USER scanner
EXPOSE 8000
CMD ["uvicorn", "scanner.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]

