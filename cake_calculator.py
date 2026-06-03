"""Aplicativo web em Python para calcular ingredientes de bolo.

Execute com:
    python cake_calculator.py

Acesse http://localhost:8000 no navegador.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import parse_qs, urlparse


@dataclass(frozen=True)
class Ingredient:
    name: str
    amount: float
    unit: str
    category: str


BASE_SERVINGS = 10
BASE_RECIPES: dict[str, dict[str, Any]] = {
    "baunilha": {
        "label": "Bolo de baunilha",
        "description": "Massa clássica, macia e equilibrada para rechear ou servir simples.",
        "bake_time": "35 a 40 minutos",
        "ingredients": [
            Ingredient("Farinha de trigo", 2.5, "xícaras", "Secos"),
            Ingredient("Açúcar", 1.75, "xícaras", "Secos"),
            Ingredient("Fermento químico", 1.0, "colher de sopa", "Secos"),
            Ingredient("Sal", 0.5, "colher de chá", "Secos"),
            Ingredient("Ovos", 3.0, "unidades", "Úmidos"),
            Ingredient("Leite", 1.0, "xícara", "Úmidos"),
            Ingredient("Óleo", 0.5, "xícara", "Úmidos"),
            Ingredient("Essência de baunilha", 1.0, "colher de sopa", "Aromas"),
        ],
    },
    "chocolate": {
        "label": "Bolo de chocolate",
        "description": "Massa intensa de chocolate com umidade ideal para festas.",
        "bake_time": "38 a 45 minutos",
        "ingredients": [
            Ingredient("Farinha de trigo", 2.0, "xícaras", "Secos"),
            Ingredient("Açúcar", 1.75, "xícaras", "Secos"),
            Ingredient("Chocolate em pó 50%", 0.75, "xícara", "Secos"),
            Ingredient("Fermento químico", 1.0, "colher de sopa", "Secos"),
            Ingredient("Sal", 0.5, "colher de chá", "Secos"),
            Ingredient("Ovos", 3.0, "unidades", "Úmidos"),
            Ingredient("Leite morno", 1.0, "xícara", "Úmidos"),
            Ingredient("Óleo", 0.5, "xícara", "Úmidos"),
        ],
    },
    "cenoura": {
        "label": "Bolo de cenoura",
        "description": "Receita brasileira fofinha, perfeita para cobertura de chocolate.",
        "bake_time": "40 a 45 minutos",
        "ingredients": [
            Ingredient("Farinha de trigo", 2.0, "xícaras", "Secos"),
            Ingredient("Açúcar", 1.5, "xícaras", "Secos"),
            Ingredient("Fermento químico", 1.0, "colher de sopa", "Secos"),
            Ingredient("Cenoura picada", 3.0, "unidades médias", "Úmidos"),
            Ingredient("Ovos", 3.0, "unidades", "Úmidos"),
            Ingredient("Óleo", 0.75, "xícara", "Úmidos"),
        ],
    },
}

PAN_MULTIPLIERS = {
    "redonda-20": {"label": "Forma redonda 20 cm", "multiplier": 1.0},
    "redonda-25": {"label": "Forma redonda 25 cm", "multiplier": 1.35},
    "retangular-media": {"label": "Forma retangular média", "multiplier": 1.25},
    "cupcakes": {"label": "Cupcakes", "multiplier": 0.9},
}


def format_amount(value: float) -> str:
    """Formata números de forma amigável para cozinha."""
    rounded = round(value, 2)
    if rounded.is_integer():
        return str(int(rounded))
    return f"{rounded:.2f}".rstrip("0").rstrip(".").replace(".", ",")


def calculate_recipe(flavor: str, servings: int, pan: str) -> dict[str, Any]:
    """Calcula ingredientes proporcionais ao sabor, porções e forma escolhidos."""
    if flavor not in BASE_RECIPES:
        raise ValueError("Escolha um sabor válido.")
    if pan not in PAN_MULTIPLIERS:
        raise ValueError("Escolha um tipo de forma válido.")
    if servings < 4 or servings > 60:
        raise ValueError("Informe entre 4 e 60 porções.")

    recipe = BASE_RECIPES[flavor]
    pan_info = PAN_MULTIPLIERS[pan]
    multiplier = (servings / BASE_SERVINGS) * pan_info["multiplier"]
    ingredients = [
        {
            "name": ingredient.name,
            "amount": format_amount(ingredient.amount * multiplier),
            "unit": ingredient.unit,
            "category": ingredient.category,
        }
        for ingredient in recipe["ingredients"]
    ]

    return {
        "flavor": recipe["label"],
        "description": recipe["description"],
        "servings": servings,
        "pan": pan_info["label"],
        "multiplier": format_amount(multiplier),
        "bake_time": recipe["bake_time"],
        "ingredients": ingredients,
        "tips": [
            "Pré-aqueça o forno a 180 °C antes de começar.",
            "Unte e enfarinhe a forma para desenformar com facilidade.",
            "Misture o fermento por último, com movimentos suaves.",
        ],
    }


HTML = """<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Calculadora de Ingredientes de Bolo</title>
  <style>
    :root { color-scheme: light; --bg:#fff7ed; --card:#ffffff; --ink:#2f1b12; --muted:#7c5b4a; --brand:#f97316; --brand-dark:#c2410c; --line:#fed7aa; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: radial-gradient(circle at top left, #ffedd5, transparent 32rem), linear-gradient(135deg, #fff7ed 0%, #fffbeb 100%); color: var(--ink); min-height: 100vh; }
    .page { width: min(1120px, calc(100% - 32px)); margin: 0 auto; padding: 40px 0; }
    .hero { display: grid; grid-template-columns: 1.1fr .9fr; gap: 28px; align-items: stretch; }
    .headline, .panel { background: rgba(255,255,255,.82); border: 1px solid rgba(254,215,170,.9); border-radius: 32px; box-shadow: 0 24px 60px rgba(124,45,18,.12); backdrop-filter: blur(14px); }
    .headline { padding: 42px; position: relative; overflow: hidden; }
    .badge { display: inline-flex; gap: 8px; align-items: center; padding: 10px 14px; border-radius: 999px; background: #ffedd5; color: var(--brand-dark); font-weight: 800; font-size: 14px; }
    h1 { font-size: clamp(38px, 6vw, 70px); line-height: .95; margin: 24px 0 18px; letter-spacing: -0.06em; }
    .lead { color: var(--muted); font-size: 20px; line-height: 1.6; max-width: 680px; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 34px; }
    .stat { background: #fff7ed; border: 1px solid var(--line); border-radius: 22px; padding: 18px; }
    .stat strong { display:block; font-size: 28px; color: var(--brand-dark); }
    .panel { padding: 28px; }
    label { display: block; font-weight: 800; margin: 16px 0 8px; }
    select, input { width: 100%; border: 1px solid var(--line); border-radius: 18px; padding: 15px 16px; background: #fff; color: var(--ink); font: inherit; outline: none; transition: .2s; }
    select:focus, input:focus { border-color: var(--brand); box-shadow: 0 0 0 4px rgba(249,115,22,.15); }
    button { width: 100%; margin-top: 22px; border: 0; border-radius: 20px; padding: 16px 18px; background: linear-gradient(135deg, var(--brand), #fb923c); color: white; font-weight: 900; font-size: 16px; cursor: pointer; box-shadow: 0 14px 28px rgba(249,115,22,.28); transition: transform .2s, box-shadow .2s; }
    button:hover { transform: translateY(-2px); box-shadow: 0 18px 32px rgba(249,115,22,.34); }
    .result { margin-top: 28px; display: grid; grid-template-columns: .85fr 1.15fr; gap: 24px; }
    .summary, .ingredients { background: var(--card); border: 1px solid var(--line); border-radius: 28px; padding: 26px; box-shadow: 0 18px 44px rgba(124,45,18,.08); }
    .summary h2, .ingredients h2 { margin: 0 0 12px; font-size: 28px; letter-spacing: -.03em; }
    .pill-row { display:flex; gap: 10px; flex-wrap: wrap; margin: 18px 0; }
    .pill { border-radius: 999px; background: #ffedd5; color: var(--brand-dark); padding: 9px 12px; font-weight: 800; font-size: 13px; }
    .ingredient { display:flex; justify-content:space-between; gap: 16px; padding: 15px 0; border-bottom: 1px dashed #fdba74; }
    .ingredient:last-child { border-bottom: 0; }
    .ingredient span { color: var(--muted); }
    .category { margin-top: 18px; color: var(--brand-dark); text-transform: uppercase; font-size: 12px; letter-spacing: .14em; font-weight: 900; }
    .tips { margin: 14px 0 0; padding-left: 20px; color: var(--muted); line-height: 1.7; }
    .error { margin-top: 16px; padding: 14px; border-radius: 16px; background: #fef2f2; color: #991b1b; font-weight: 700; display: none; }
    footer { text-align: center; color: var(--muted); padding: 26px 0 0; }
    @media (max-width: 840px) { .hero, .result { grid-template-columns: 1fr; } .headline { padding: 28px; } .stats { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <div class="headline">
        <span class="badge">🍰 Calculadora inteligente</span>
        <h1>Ajuste sua receita de bolo em segundos.</h1>
        <p class="lead">Escolha o sabor, quantidade de porções e tipo de forma. O app calcula os ingredientes proporcionais e entrega dicas rápidas para um preparo mais seguro.</p>
        <div class="stats">
          <div class="stat"><strong>3</strong><span>sabores prontos</span></div>
          <div class="stat"><strong>4-60</strong><span>porções</span></div>
          <div class="stat"><strong>180°C</strong><span>forno ideal</span></div>
        </div>
      </div>
      <form class="panel" id="calculator">
        <label for="flavor">Sabor do bolo</label>
        <select id="flavor" name="flavor">
          <option value="baunilha">Bolo de baunilha</option>
          <option value="chocolate">Bolo de chocolate</option>
          <option value="cenoura">Bolo de cenoura</option>
        </select>
        <label for="servings">Quantidade de porções</label>
        <input id="servings" name="servings" type="number" min="4" max="60" value="12" required>
        <label for="pan">Tipo de forma</label>
        <select id="pan" name="pan">
          <option value="redonda-20">Forma redonda 20 cm</option>
          <option value="redonda-25">Forma redonda 25 cm</option>
          <option value="retangular-media">Forma retangular média</option>
          <option value="cupcakes">Cupcakes</option>
        </select>
        <button type="submit">Calcular ingredientes</button>
        <div class="error" id="error"></div>
      </form>
    </section>
    <section class="result" id="result" aria-live="polite"></section>
    <footer>Feito em Python com servidor HTTP nativo.</footer>
  </main>
  <script>
    const form = document.querySelector('#calculator');
    const result = document.querySelector('#result');
    const errorBox = document.querySelector('#error');

    const groupByCategory = (items) => items.reduce((groups, item) => {
      groups[item.category] = groups[item.category] || [];
      groups[item.category].push(item);
      return groups;
    }, {});

    function render(data) {
      const groups = groupByCategory(data.ingredients);
      const ingredientHtml = Object.entries(groups).map(([category, items]) => `
        <div class="category">${category}</div>
        ${items.map(item => `<div class="ingredient"><strong>${item.name}</strong><span>${item.amount} ${item.unit}</span></div>`).join('')}
      `).join('');

      result.innerHTML = `
        <article class="summary">
          <h2>${data.flavor}</h2>
          <p class="lead">${data.description}</p>
          <div class="pill-row">
            <span class="pill">${data.servings} porções</span>
            <span class="pill">${data.pan}</span>
            <span class="pill">Multiplicador ${data.multiplier}x</span>
            <span class="pill">Forno: ${data.bake_time}</span>
          </div>
          <h3>Dicas rápidas</h3>
          <ul class="tips">${data.tips.map(tip => `<li>${tip}</li>`).join('')}</ul>
        </article>
        <article class="ingredients">
          <h2>Lista de ingredientes</h2>
          ${ingredientHtml}
        </article>`;
    }

    async function calculate() {
      errorBox.style.display = 'none';
      const params = new URLSearchParams(new FormData(form));
      const response = await fetch(`/api/calculate?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        errorBox.textContent = data.error || 'Não foi possível calcular a receita.';
        errorBox.style.display = 'block';
        return;
      }
      render(data);
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      calculate();
    });
    calculate();
  </script>
</body>
</html>
"""


class CakeCalculatorHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802 - API do BaseHTTPRequestHandler
        parsed = urlparse(self.path)
        if parsed.path == "/":
            self._send(HTML, "text/html; charset=utf-8")
            return
        if parsed.path == "/api/calculate":
            self._handle_calculate(parsed.query)
            return
        self._send_json({"error": "Página não encontrada."}, HTTPStatus.NOT_FOUND)

    def _handle_calculate(self, query: str) -> None:
        params = parse_qs(query)
        try:
            flavor = params.get("flavor", ["baunilha"])[0]
            pan = params.get("pan", ["redonda-20"])[0]
            servings = int(params.get("servings", [str(BASE_SERVINGS)])[0])
            self._send_json(calculate_recipe(flavor, servings, pan))
        except (TypeError, ValueError) as error:
            self._send_json({"error": str(error)}, HTTPStatus.BAD_REQUEST)

    def _send_json(self, payload: dict[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
        self._send(json.dumps(payload, ensure_ascii=False), "application/json; charset=utf-8", status)

    def _send(self, body: str, content_type: str, status: HTTPStatus = HTTPStatus.OK) -> None:
        encoded = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A002 - assinatura da biblioteca padrão
        if os.environ.get("CAKE_CALCULATOR_DEBUG") == "1":
            super().log_message(format, *args)


def create_server(host: str = "0.0.0.0", port: int = 8000) -> ThreadingHTTPServer:
    return ThreadingHTTPServer((host, port), CakeCalculatorHandler)


def main() -> None:
    port = int(os.environ.get("PORT", "8000"))
    server = create_server(port=port)
    print(f"Calculadora de bolo disponível em http://localhost:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor finalizado.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
