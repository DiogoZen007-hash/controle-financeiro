const API_URL =
  "https://script.google.com/macros/s/AKfycbwo3qeXL_2q-oeKyecG3yziIASv3jrGVxLv9MMV-3hnls6g2A5HsUEZMzXLb2iDBRLQ/exec";

let transactions = [];
let currentPeriod = "month";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit"
});

// ==============================
// BUSCAR DADOS DO GOOGLE SHEETS
// ==============================

async function loadTransactions() {
  const sync = document.getElementById("sync");

  try {
    sync.textContent = "Sincronizando com Google Sheets...";

    // Evita cache para mostrar novos gastos rapidamente
    const response = await fetch(
      API_URL + "?t=" + Date.now()
    );

    if (!response.ok) {
      throw new Error(
        `Erro HTTP ${response.status}`
      );
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(
        result.error || "Erro ao carregar os dados."
      );
    }

    transactions = Array.isArray(result.data)
      ? result.data
      : [];

    render();

    sync.textContent =
      "✓ Sincronizado com Google Sheets";

  } catch (error) {
    console.error(error);

    sync.textContent =
      "⚠ Não foi possível sincronizar";

    document.getElementById("transactions").innerHTML =
      `<div class="empty">
        Erro ao carregar os dados.<br>
        ${escapeHtml(error.message)}
      </div>`;
  }
}


// ==============================
// NORMALIZAR TRANSAÇÕES
// ==============================

function normalizeTransaction(item) {

  const date =
    item.Data ??
    item.data ??
    item.Date ??
    item.date;

  const type =
    item.Tipo ??
    item.tipo ??
    item.Type ??
    item.type ??
    "";

  const description =
    item.Descrição ??
    item.Descricao ??
    item.descrição ??
    item.descricao ??
    item.Description ??
    item.description ??
    "Sem descrição";

  const rawValue =
    item.Valor ??
    item.valor ??
    item.Amount ??
    item.amount ??
    0;

  return {
    date: parseDate(date),
    type: String(type).trim(),
    description: String(description).trim(),
    value: parseMoney(rawValue)
  };
}


// ==============================
// CONVERTER VALOR
// ==============================

function parseMoney(value) {

  if (typeof value === "number") {
    return value;
  }

  if (!value) {
    return 0;
  }

  let text = String(value)
    .replace("R$", "")
    .trim();

  // Formato brasileiro: 1.234,56
  if (
    text.includes(",") &&
    text.includes(".")
  ) {
    text = text
      .replace(/\./g, "")
      .replace(",", ".");
  }

  // Formato: 150,50
  else if (text.includes(",")) {
    text = text.replace(",", ".");
  }

  const number = Number(text);

  return Number.isFinite(number)
    ? number
    : 0;
}


// ==============================
// CONVERTER DATA
// ==============================

function parseDate(value) {

  if (!value) {
    return new Date();
  }

  const direct = new Date(value);

  if (!isNaN(direct.getTime())) {
    return direct;
  }

  // Tenta DD/MM/AAAA
  const parts =
    String(value).match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})/
    );

  if (parts) {
    return new Date(
      Number(parts[3]),
      Number(parts[2]) - 1,
      Number(parts[1])
    );
  }

  return new Date();
}


// ==============================
// IDENTIFICAR TIPO
// ==============================

function getType(type) {

  const text = String(type)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (
    text.includes("entrada") ||
    text.includes("receita")
  ) {
    return "income";
  }

  if (
    text.includes("fixo") ||
    text.includes("fixa") ||
    text.includes("mensal")
  ) {
    return "fixed";
  }

  return "expense";
}


// ==============================
// FILTRO SEMANA / MÊS
// ==============================

function isInPeriod(date, period) {

  const now = new Date();

  if (period === "month") {

    return (
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  }

  // Semana começando segunda-feira
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const day =
    today.getDay() === 0
      ? 7
      : today.getDay();

  const monday =
    new Date(today);

  monday.setDate(
    today.getDate() - day + 1
  );

  monday.setHours(0, 0, 0, 0);

  const nextMonday =
    new Date(monday);

  nextMonday.setDate(
    monday.getDate() + 7
  );

  return (
    date >= monday &&
    date < nextMonday
  );
}


// ==============================
// RENDERIZAR DASHBOARD
// ==============================

function render() {

  const normalized =
    transactions
      .map(normalizeTransaction)
      .filter(item =>
        isInPeriod(
          item.date,
          currentPeriod
        )
      )
      .sort(
        (a, b) =>
          b.date - a.date
      );

  let income = 0;
  let expense = 0;
  let fixed = 0;

  normalized.forEach(item => {

    const type =
      getType(item.type);

    if (type === "income") {
      income += item.value;
    }

    else if (type === "fixed") {
      fixed += item.value;
    }

    else {
      expense += item.value;
    }

  });

  const totalExpenses =
    expense + fixed;

  const balance =
    income - totalExpenses;

  document.getElementById(
    "balance"
  ).textContent =
    money.format(balance);

  document.getElementById(
    "income"
  ).textContent =
    money.format(income);

  document.getElementById(
    "expense"
  ).textContent =
    money.format(expense);

  document.getElementById(
    "fixed"
  ).textContent =
    money.format(fixed);


  // Média semanal
  const avg =
    currentPeriod === "month"
      ? totalExpenses / 4.345
      : totalExpenses;

  document.getElementById(
    "avg"
  ).textContent =
    money.format(avg);


  document.getElementById(
    "periodLabel"
  ).textContent =
    currentPeriod === "month"
      ? "Este mês"
      : "Esta semana";


  renderTransactions(
    normalized
  );
}


// ==============================
// LISTA DE MOVIMENTAÇÕES
// ==============================

function renderTransactions(items) {

  const container =
    document.getElementById(
      "transactions"
    );

  if (!items.length) {

    container.innerHTML =
      `<div class="empty">
        Nenhuma movimentação neste período.
      </div>`;

    return;
  }

  container.innerHTML =
    items.map(item => {

      const type =
        getType(item.type);

      let colorClass =
        "red";

      let symbol =
        "−";

      if (type === "income") {
        colorClass = "green";
        symbol = "+";
      }

      if (type === "fixed") {
        colorClass = "yellow";
        symbol = "−";
      }

      return `
        <div class="tx">

          <span class="dot ${colorClass}">
          </span>

          <div class="tx-main">

            <b>
              ${escapeHtml(
                item.description
              )}
            </b>

            <small>
              ${dateFormatter.format(
                item.date
              )}
              •
              ${escapeHtml(
                item.type
              )}
            </small>

          </div>

          <strong class="${colorClass}">
            ${symbol}
            ${money.format(
              item.value
            )}
          </strong>

        </div>
      `;

    }).join("");
}


// ==============================
// BOTÕES SEMANA / MÊS
// ==============================

document
  .querySelectorAll(".tab")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        document
          .querySelectorAll(".tab")
          .forEach(tab =>
            tab.classList.remove("on")
          );

        button.classList.add("on");

        currentPeriod =
          button.dataset.period;

        render();
      }
    );

  });


// ==============================
// SEGURANÇA DO HTML
// ==============================

function escapeHtml(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// ==============================
// ATUALIZAÇÃO AUTOMÁTICA
// ==============================

// Carrega ao abrir o app
loadTransactions();

// Atualiza a cada 30 segundos
setInterval(
  loadTransactions,
  30000
);

// Atualiza quando o usuário
// volta para o aplicativo
document.addEventListener(
  "visibilitychange",
  () => {

    if (
      document.visibilityState ===
      "visible"
    ) {
      loadTransactions();
    }

  }
);
