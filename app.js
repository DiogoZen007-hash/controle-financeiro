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

async function loadTransactions() {
  const sync = document.getElementById("sync");

  try {
    if (sync) {
      sync.textContent = "Sincronizando...";
    }

    const response = await fetch(
      API_URL + "?t=" + Date.now()
    );

    if (!response.ok) {
      throw new Error("Erro ao acessar a planilha");
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(
        result.error || "Erro ao carregar dados"
      );
    }

    transactions = Array.isArray(result.data)
      ? result.data
      : [];

    render();

    if (sync) {
      sync.textContent = "✓ Sincronizado";
    }

  } catch (error) {
    console.error(error);

    if (sync) {
      sync.textContent = "⚠ Erro de sincronização";
    }
  }
}

function normalizeTransaction(item) {
  return {
    date: parseDate(
      item.Data ??
      item.data ??
      item.Date ??
      item.date
    ),

    type: String(
      item.Tipo ??
      item.tipo ??
      item.Type ??
      item.type ??
      ""
    ).trim(),

    description: String(
      item.Descrição ??
      item.Descricao ??
      item.descrição ??
      item.descricao ??
      item.Description ??
      item.description ??
      "Sem descrição"
    ).trim(),

    value: parseMoney(
      item.Valor ??
      item.valor ??
      item.Amount ??
      item.amount ??
      0
    )
  };
}

function parseMoney(value) {
  if (typeof value === "number") {
    return value;
  }

  if (!value) return 0;

  let text = String(value)
    .replace("R$", "")
    .trim();

  if (text.includes(",") && text.includes(".")) {
    text = text
      .replace(/\./g, "")
      .replace(",", ".");
  } else if (text.includes(",")) {
    text = text.replace(",", ".");
  }

  const number = Number(text);

  return Number.isFinite(number)
    ? number
    : 0;
}

function parseDate(value) {
  if (!value) return new Date();

  const direct = new Date(value);

  if (!isNaN(direct.getTime())) {
    return direct;
  }

  const parts = String(value).match(
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

function isInPeriod(date, period) {
  const now = new Date();

  if (period === "month") {
    return (
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  }

  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const day =
    today.getDay() === 0
      ? 7
      : today.getDay();

  const monday = new Date(today);

  monday.setDate(
    today.getDate() - day + 1
  );

  monday.setHours(0, 0, 0, 0);

  const nextMonday = new Date(monday);

  nextMonday.setDate(
    monday.getDate() + 7
  );

  return date >= monday && date < nextMonday;
}

function render() {
  const items = transactions
    .map(normalizeTransaction)
    .filter(item =>
      isInPeriod(item.date, currentPeriod)
    )
    .sort((a, b) => b.date - a.date);

  let income = 0;
  let expense = 0;
  let fixed = 0;

  items.forEach(item => {
    const type = getType(item.type);

    if (type === "income") {
      income += item.value;
    } else if (type === "fixed") {
      fixed += item.value;
    } else {
      expense += item.value;
    }
  });

  const balance =
    income - expense - fixed;

  setText(
    "income",
    money.format(income)
  );

  setText(
    "expense",
    "- " + money.format(expense)
  );

  setText(
    "fixed",
    "- " + money.format(fixed)
  );

  setText(
    "balance",
    money.format(balance)
  );

  setText(
    "periodLabel",
    currentPeriod === "month"
      ? "Este mês"
      : "Esta semana"
  );

  renderTransactions(items);
}

function setText(id, text) {
  const element =
    document.getElementById(id);

  if (element) {
    element.textContent = text;
  }
}

function renderTransactions(items) {
  const container =
    document.getElementById("transactions");

  if (!container) return;

  if (!items.length) {
    container.innerHTML = `
      <div class="empty">
        Nenhuma movimentação neste período
      </div>
    `;
    return;
  }

  container.innerHTML = items
    .map(item => {
      const type = getType(item.type);

      let cssClass = "red";
      let symbol = "−";

      if (type === "income") {
        cssClass = "green";
        symbol = "+";
      }

      if (type === "fixed") {
        cssClass = "yellow";
      }

      return `
        <div class="transaction">

          <div class="transaction-info">

            <strong>
              ${escapeHtml(item.description)}
            </strong>

            <span>
              ${dateFormatter.format(item.date)}
              •
              ${escapeHtml(item.type)}
            </span>

          </div>

          <div class="transaction-value ${cssClass}">
            ${symbol}
            ${money.format(item.value)}
          </div>

        </div>
      `;
    })
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* SEMANA / MÊS */

document
  .querySelectorAll("[data-period]")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        document
          .querySelectorAll("[data-period]")
          .forEach(item =>
            item.classList.remove("active")
          );

        button.classList.add("active");

        currentPeriod =
          button.dataset.period;

        render();
      }
    );
  });

/* SINCRONIZAÇÃO */

loadTransactions();

/* Atualiza a cada 30 segundos */

setInterval(
  loadTransactions,
  30000
);

/* Atualiza imediatamente
   quando voltar ao app */

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
