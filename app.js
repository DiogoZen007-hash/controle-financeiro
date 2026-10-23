const API_URL =
  "https://script.google.com/macros/s/AKfycbwo3qeXL_2q-oeKyecG3yziIASv3jrGVxLv9MMV-3hnls6g2A5HsUEZMzXLb2iDBRLQ/exec";

let transactions = [];
let currentPeriod = "month";

let manualType = "Gasto";
let manualCategory = "Alimentação";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit"
});


/* =========================
   CARREGAR MOVIMENTAÇÕES
========================= */

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


/* =========================
   NORMALIZAR DADOS
========================= */

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

    category: String(
      item.Categoria ??
      item.categoria ??
      item.Category ??
      item.category ??
      ""
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

  if (
    text.includes(",") &&
    text.includes(".")
  ) {

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

  if (!value) {
    return new Date();
  }

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


/* =========================
   TIPO
========================= */

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


/* =========================
   PERÍODO
========================= */

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

  return (
    date >= monday &&
    date < nextMonday
  );
}


/* =========================
   RENDER
========================= */

function render() {

  const items = transactions
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

  items.forEach(item => {

    const type =
      getType(item.type);

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
    "− " + money.format(expense)
  );

  setText(
    "fixed",
    "− " + money.format(fixed)
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


/* =========================
   LISTA DE MOVIMENTAÇÕES
========================= */

function renderTransactions(items) {

  const container =
    document.getElementById(
      "transactions"
    );

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

      const type =
        getType(item.type);

      let cssClass = "red";
      let symbol = "−";

      if (type === "income") {

        cssClass = "green";
        symbol = "+";
      }

      if (type === "fixed") {

        cssClass = "yellow";
      }

      const secondary = item.category
        ? `${dateFormatter.format(item.date)} • ${escapeHtml(item.category)}`
        : `${dateFormatter.format(item.date)} • ${escapeHtml(item.type)}`;

      return `
        <div class="tx">

          <div class="dot ${cssClass}">
          </div>

          <div class="txmain">

            <b>
              ${escapeHtml(item.description)}
            </b>

            <small>
              ${secondary}
            </small>

          </div>

          <strong class="${cssClass}">
            ${symbol}${money.format(item.value)}
          </strong>

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


/* =========================
   SEMANA / MÊS
========================= */

document
  .querySelectorAll("[data-period]")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        document
          .querySelectorAll("[data-period]")
          .forEach(item => {

            item.classList.remove("on");
          });

        button.classList.add("on");

        currentPeriod =
          button.dataset.period;

        render();
      }
    );
  });


/* =========================
   MODAL
========================= */

const modal =
  document.getElementById(
    "transactionModal"
  );

const openModalButton =
  document.getElementById(
    "openTransactionModal"
  );

const closeModalButton =
  document.getElementById(
    "closeTransactionModal"
  );


function openModal() {

  if (!modal) return;

  modal.classList.add("open");

  document.body.classList.add(
    "modal-open"
  );

  setTimeout(() => {

    document
      .getElementById("manualValue")
      ?.focus();

  }, 250);
}


function closeModal() {

  if (!modal) return;

  modal.classList.remove("open");

  document.body.classList.remove(
    "modal-open"
  );
}


openModalButton?.addEventListener(
  "click",
  openModal
);


closeModalButton?.addEventListener(
  "click",
  closeModal
);


modal?.addEventListener(
  "click",
  event => {

    if (event.target === modal) {
      closeModal();
    }
  }
);


/* =========================
   ESCOLHER TIPO
========================= */

document
  .querySelectorAll(".type-option")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        document
          .querySelectorAll(
            ".type-option"
          )
          .forEach(item => {

            item.classList.remove(
              "active"
            );
          });

        button.classList.add(
          "active"
        );

        manualType =
          button.dataset.type;
      }
    );
  });


/* =========================
   ESCOLHER CATEGORIA
========================= */

document
  .querySelectorAll(".category")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        document
          .querySelectorAll(
            ".category"
          )
          .forEach(item => {

            item.classList.remove(
              "active"
            );
          });

        button.classList.add(
          "active"
        );

        manualCategory =
          button.dataset.category;
      }
    );
  });


/* =========================
   FORMATAR VALOR
========================= */

const manualValue =
  document.getElementById(
    "manualValue"
  );


manualValue?.addEventListener(
  "input",
  event => {

    let digits =
      event.target.value
        .replace(/\D/g, "");

    if (!digits) {

      event.target.value = "";
      return;
    }

    const value =
      Number(digits) / 100;

    event.target.value =
      money.format(value);
  }
);


function getManualValue() {

  if (!manualValue) {
    return 0;
  }

  const digits =
    manualValue.value
      .replace(/\D/g, "");

  if (!digits) {
    return 0;
  }

  return Number(digits) / 100;
}


/* =========================
   SALVAR MOVIMENTAÇÃO
========================= */

const saveButton =
  document.getElementById(
    "saveManualTransaction"
  );


saveButton?.addEventListener(
  "click",
  async () => {

    const description =
      document
        .getElementById(
          "manualDescription"
        )
        ?.value
        .trim() || "";

    const value =
      getManualValue();

    if (value <= 0) {

      alert(
        "Digite um valor válido."
      );

      return;
    }

    if (!description) {

      alert(
        "Digite uma descrição."
      );

      return;
    }

    const originalText =
      saveButton.textContent;

    try {

      saveButton.disabled = true;

      saveButton.textContent =
        "Adicionando...";

      const response = await fetch(
        API_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "text/plain;charset=utf-8"
          },

          body: JSON.stringify({
            tipo: manualType,
            descricao: description,
            categoria: manualCategory,
            amount: value
          })
        }
      );

      if (!response.ok) {

        throw new Error(
          "Não foi possível salvar."
        );
      }

      const result =
        await response.json();

      if (!result.success) {

        throw new Error(
          result.error ||
          "Erro ao salvar movimentação."
        );
      }

      closeModal();

      resetManualForm();

      await loadTransactions();

    } catch (error) {

      console.error(error);

      alert(
        "Não foi possível adicionar a movimentação. Tente novamente."
      );

    } finally {

      saveButton.disabled = false;

      saveButton.textContent =
        originalText;
    }
  }
);


/* =========================
   LIMPAR FORMULÁRIO
========================= */

function resetManualForm() {

  const value =
    document.getElementById(
      "manualValue"
    );

  const description =
    document.getElementById(
      "manualDescription"
    );

  if (value) {
    value.value = "";
  }

  if (description) {
    description.value = "";
  }

  manualType = "Gasto";
  manualCategory = "Alimentação";

  document
    .querySelectorAll(
      ".type-option"
    )
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.type === "Gasto"
      );
    });

  document
    .querySelectorAll(
      ".category"
    )
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.category ===
          "Alimentação"
      );
    });
}


/* =========================
   SINCRONIZAÇÃO
========================= */

loadTransactions();


setInterval(
  loadTransactions,
  30000
);


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
