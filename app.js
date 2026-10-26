const API_URL =
  "https://script.google.com/macros/s/AKfycbwo3qeXL_2q-oeKyecG3yziIASv3jrGVxLv9MMV-3hnls6g2A5HsUEZMzXLb2iDBRLQ/exec";

let transactions = [];
let fixedExpenses = [];
const expensesPage =
  document.getElementById(
    "expensesPage"
  );

const openExpenses =
  document.getElementById(
    "openExpenses"
  );

const closeExpenses =
  document.getElementById(
    "closeExpenses"
  );
let currentPeriod = "month";
let selectedDate = new Date();

/*
  null = mês/semana
  Date = dia específico
*/
let selectedDay = null;
let manualType = "Gasto";
let manualCategory = "Alimentação";

/* null = nova movimentação
   número = linha sendo editada */
let editingRow = null;
let editingFixedRow = null;
const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit"
});


/* =========================
   CARREGAR
========================= */

async function loadTransactions() {

  const sync =
    document.getElementById("sync");

  try {

    if (sync) {
      sync.textContent = "Sincronizando...";
    }

    const response = await fetch(
      API_URL + "?t=" + Date.now()
    );

    if (!response.ok) {
      throw new Error(
        "Erro ao acessar a planilha"
      );
    }

    const result =
      await response.json();

    if (!result.success) {
      throw new Error(
        result.error ||
        "Erro ao carregar dados"
      );
    }

    transactions =
  Array.isArray(result.data)
    ? result.data
    : [];

fixedExpenses =
  Array.isArray(result.fixed)
    ? result.fixed
    : [];

render();
renderFixedExpenses();
    
    if (sync) {
      sync.textContent =
        "✓ Sincronizado";
    }

  } catch (error) {

    console.error(error);

    if (sync) {
      sync.textContent =
        "⚠ Erro de sincronização";
    }
  }
}


/* =========================
   NORMALIZAR
========================= */

function normalizeTransaction(item) {

  return {

    row: Number(
      item._row ??
      item.row ??
      0
    ),

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

    text =
      text.replace(",", ".");
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

  const direct =
    new Date(value);

  if (!isNaN(direct.getTime())) {
    return direct;
  }

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


/* =========================
   TIPO
========================= */

function getType(type) {

  const text =
    String(type)
      .toLowerCase()
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      );

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
if (selectedDay) {

  return (
    date.getDate() ===
      selectedDay.getDate() &&

    date.getMonth() ===
      selectedDay.getMonth() &&

    date.getFullYear() ===
      selectedDay.getFullYear()
  );
}
  if (period === "month") {

    return (
      date.getMonth() ===
        selectedDate.getMonth() &&
      date.getFullYear() ===
        selectedDate.getFullYear()
    );
  }

  const reference =
    new Date(selectedDate);

  const day =
    reference.getDay() === 0
      ? 7
      : reference.getDay();

  const monday =
    new Date(
      reference.getFullYear(),
      reference.getMonth(),
      reference.getDate()
    );

  monday.setDate(
    monday.getDate() - day + 1
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


/* =========================
   RENDER
========================= */

function render() {

  const items =
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

  items.forEach(item => {

  const type =
    getType(item.type);

  if (type === "income") {

    income += item.value;

  } else if (
    type === "expense"
  ) {

    expense += item.value;
  }
});


/*
  Gastos fixos são recorrentes.
  Por isso não dependem do mês
  selecionado.
*/

fixed =
  fixedExpenses.reduce(
    (total, item) => {

      return total +
        parseMoney(
          item.Valor ??
          item.valor ??
          0
        );
    },
    0
  );

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

  let periodText;

if (selectedDay) {

  periodText =
    selectedDay.toLocaleDateString(
      "pt-BR",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      }
    );

} else {

  periodText =
    currentPeriod === "month"
      ? "Este mês"
      : "Esta semana";
}

setText(
  "periodLabel",
  periodText
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
   MOVIMENTAÇÕES
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

  container.innerHTML =
    items.map(item => {

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

      const secondary =
        item.category
          ? `${dateFormatter.format(item.date)} • ${escapeHtml(item.category)}`
          : `${dateFormatter.format(item.date)} • ${escapeHtml(item.type)}`;

      return `
        <div
          class="tx"
          data-row="${item.row}"
          role="button"
          tabindex="0"
          style="cursor:pointer"
        >

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
    }).join("");

  container
    .querySelectorAll(".tx")
    .forEach(element => {

      element.addEventListener(
        "click",
        () => {

          const row =
            Number(element.dataset.row);

          openEditModal(row);
        }
      );
    });
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
          .querySelectorAll(
            "[data-period]"
          )
          .forEach(item =>
            item.classList.remove("on")
          );

        button.classList.add("on");

        currentPeriod =
  button.dataset.period;

selectedDay = null;

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

const modalTitle =
  document.getElementById(
    "transactionModalTitle"
  );

const deleteButton =
  document.getElementById(
    "deleteTransaction"
  );


function showModal() {

  if (!modal) return;

  modal.classList.add("open");

  document.body.classList.add(
    "modal-open"
  );

  setTimeout(() => {

    document
      .getElementById(
        "manualValue"
      )
      ?.focus();

  }, 250);
}


function openNewModal() {

  editingRow = null;

  resetManualForm();

  if (modalTitle) {
    modalTitle.textContent =
      "Nova movimentação";
  }

  if (saveButton) {
    saveButton.textContent =
      "Adicionar movimentação";
  }

  if (deleteButton) {
    deleteButton.style.display =
      "none";
  }

  showModal();
}


function openEditModal(row) {

  const item =
    transactions
      .map(normalizeTransaction)
      .find(transaction =>
        transaction.row === row
      );

  if (!item) {
    alert(
      "Não foi possível localizar esta movimentação."
    );
    return;
  }

  editingRow = row;

  manualType =
    item.type || "Gasto";

  manualCategory =
    item.category ||
    "Outros";

  const value =
    document.getElementById(
      "manualValue"
    );

  const description =
    document.getElementById(
      "manualDescription"
    );

  if (value) {
    value.value =
      money.format(item.value);
  }

  if (description) {
    description.value =
      item.description;
  }

  document
    .querySelectorAll(
      ".type-option"
    )
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.type ===
          manualType
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
          manualCategory
      );
    });

  if (modalTitle) {
    modalTitle.textContent =
      "Editar movimentação";
  }

  if (saveButton) {
    saveButton.textContent =
      "Salvar alterações";
  }

  if (deleteButton) {
    deleteButton.style.display =
      "block";
  }

  showModal();
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
  openNewModal
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
   TIPO
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
          .forEach(item =>
            item.classList.remove(
              "active"
            )
          );

        button.classList.add(
          "active"
        );

        manualType =
          button.dataset.type;
      }
    );
  });


/* =========================
   CATEGORIA
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
          .forEach(item =>
            item.classList.remove(
              "active"
            )
          );

        button.classList.add(
          "active"
        );

        manualCategory =
          button.dataset.category;
      }
    );
  });


/* =========================
   VALOR
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
   SALVAR / EDITAR
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

    const isEditing =
      editingRow !== null;

    try {

      saveButton.disabled = true;

      saveButton.textContent =
        isEditing
          ? "Salvando..."
          : "Adicionando...";

      const payload = {

        action:
          isEditing
            ? "update"
            : "create",

        tipo: manualType,

        descricao:
          description,

        categoria:
          manualCategory,

        amount: value
      };

      if (isEditing) {
        payload.row = editingRow;
      }

      const response =
        await fetch(
          API_URL,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "text/plain;charset=utf-8"
            },

            body:
              JSON.stringify(
                payload
              )
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

      editingRow = null;

      resetManualForm();

      await loadTransactions();

    } catch (error) {

      console.error(error);

      alert(
        "Não foi possível salvar a movimentação. Tente novamente."
      );

    } finally {

      saveButton.disabled = false;

      saveButton.textContent =
        editingRow === null
          ? "Adicionar movimentação"
          : "Salvar alterações";
    }
  }
);


/* =========================
   EXCLUIR
========================= */

deleteButton?.addEventListener(
  "click",
  async () => {

    if (editingRow === null) {
      return;
    }

    const confirmed =
      confirm(
        "Excluir esta movimentação?"
      );

    if (!confirmed) {
      return;
    }

    const rowToDelete =
      editingRow;

    try {

      deleteButton.disabled = true;

      deleteButton.textContent =
        "Excluindo...";

      const response =
        await fetch(
          API_URL,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "text/plain;charset=utf-8"
            },

            body:
              JSON.stringify({
                action: "delete",
                row: rowToDelete
              })
          }
        );

      if (!response.ok) {

        throw new Error(
          "Não foi possível excluir."
        );
      }

      const result =
        await response.json();

      if (!result.success) {

        throw new Error(
          result.error ||
          "Erro ao excluir."
        );
      }

      editingRow = null;

      closeModal();

      resetManualForm();

      await loadTransactions();

    } catch (error) {

      console.error(error);

      alert(
        "Não foi possível excluir a movimentação. Tente novamente."
      );

    } finally {

      deleteButton.disabled = false;

      deleteButton.textContent =
        "Excluir movimentação";
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

  manualCategory =
    "Alimentação";

  document
    .querySelectorAll(
      ".type-option"
    )
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.type ===
          "Gasto"
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
   GASTOS FIXOS
========================= */

const fixedExpensesPage =
  document.getElementById(
    "fixedExpensesPage"
  );

const openFixedExpenses =
  document.getElementById(
    "openFixedExpenses"
  );

const closeFixedExpenses =
  document.getElementById(
    "closeFixedExpenses"
  );

const fixedExpensesList =
  document.getElementById(
    "fixedExpensesList"
  );

const fixedExpensesTotal =
  document.getElementById(
    "fixedExpensesTotal"
  );

const addFixedExpense =
  document.getElementById(
    "addFixedExpense"
  );

const fixedExpenseModal =
  document.getElementById(
    "fixedExpenseModal"
  );

const closeFixedExpenseModal =
  document.getElementById(
    "closeFixedExpenseModal"
  );

const fixedModalTitle =
  document.getElementById(
    "fixedModalTitle"
  );

const fixedDescription =
  document.getElementById(
    "fixedDescription"
  );

const fixedValue =
  document.getElementById(
    "fixedValue"
  );

const saveFixedExpense =
  document.getElementById(
    "saveFixedExpense"
  );


/* NORMALIZAR FIXO */

function normalizeFixedExpense(
  item
) {

  return {

    row: Number(
      item._row ??
      item.row ??
      0
    ),

    description:
      String(
        item.Descrição ??
        item.Descricao ??
        item.descrição ??
        item.descricao ??
        ""
      ).trim(),

    value:
      parseMoney(
        item.Valor ??
        item.valor ??
        0
      )
  };
}


/* RENDERIZAR FIXOS */

function renderFixedExpenses() {

  const items =
    fixedExpenses
      .map(
        normalizeFixedExpense
      );

  const total =
    items.reduce(
      (sum, item) =>
        sum + item.value,
      0
    );


  if (fixedExpensesTotal) {

    fixedExpensesTotal.textContent =
      money.format(total);
  }


  if (!fixedExpensesList) {
    return;
  }


  if (!items.length) {

    fixedExpensesList.innerHTML = `
      <div class="fixed-empty">
        Nenhum gasto fixo cadastrado.
      </div>
    `;

    return;
  }


  fixedExpensesList.innerHTML =
    items.map(item => {

      return `
        <div class="fixed-item">

          <div class="fixed-item-value">
            ${money.format(item.value)}
          </div>

          <div class="fixed-item-description">
            ${escapeHtml(
              item.description
            )}
          </div>

          <div class="fixed-actions">

            <button
              class="fixed-action edit-fixed"
              data-row="${item.row}"
              aria-label="Editar"
            >
              ✏️
            </button>

            <button
              class="fixed-action delete delete-fixed"
              data-row="${item.row}"
              aria-label="Excluir"
            >
              🗑️
            </button>

          </div>

        </div>
      `;
    }).join("");


  fixedExpensesList
    .querySelectorAll(
      ".edit-fixed"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          openFixedEditModal(
            Number(
              button.dataset.row
            )
          );
        }
      );
    });


  fixedExpensesList
    .querySelectorAll(
      ".delete-fixed"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          deleteFixedExpense(
            Number(
              button.dataset.row
            )
          );
        }
      );
    });
}

/* ========================================
   TELA DE GASTOS
======================================== */

/* ========================================
   TELA DE GASTOS
======================================== */

function showExpensesPage() {

  const page =
    document.getElementById(
      "expensesPage"
    );

  if (!page) {
    return;
  }


  const items =
    transactions
      .map(
        normalizeTransaction
      )
      .filter(item =>
        isInPeriod(
          item.date,
          currentPeriod
        )
      );


  const expenseTotal =
    items
      .filter(
        item =>
          getType(item.type) ===
          "expense"
      )
      .reduce(
        (total, item) =>
          total + item.value,
        0
      );


  const incomeTotal =
    items
      .filter(
        item =>
          getType(item.type) ===
          "income"
      )
      .reduce(
        (total, item) =>
          total + item.value,
        0
      );


  setText(
    "expensesTotal",
    "− " + money.format(
      expenseTotal
    )
  );


  setText(
    "expensesSpentValue",
    money.format(
      expenseTotal
    )
  );


  setText(
    "expensesIncomeValue",
    money.format(
      incomeTotal
    )
  );


  const status =
    document.getElementById(
      "expensesComparisonStatus"
    );

  const description =
    document.getElementById(
      "expensesComparisonDescription"
    );


  if (
    expenseTotal > incomeTotal
  ) {

    if (status) {
      status.textContent =
        "Gastos prevalecem";

      status.style.color =
        "#ff4f59";
    }

    if (description) {
      description.textContent =
        "Você gastou mais do que ganhou neste período.";
    }

  } else if (
    incomeTotal > expenseTotal
  ) {

    if (status) {
      status.textContent =
        "Entradas prevalecem";

      status.style.color =
        "#2ee58a";
    }

    if (description) {
      description.textContent =
        "Você ganhou mais do que gastou neste período.";
    }

  } else {

    if (status) {
      status.textContent =
        "Equilibrado";

      status.style.color =
        "#ffffff";
    }

    if (description) {
      description.textContent =
        expenseTotal === 0
          ? "Ainda não há entradas ou gastos registrados neste período."
          : "Seus gastos e entradas estão equilibrados.";
    }
  }

  const expenseItems =
  items
    .filter(
      item =>
        getType(item.type) ===
        "expense"
    )
    .sort(
      (a, b) =>
        b.date - a.date
    );


setText(
  "expensesTransactionCount",
  expenseItems.length === 1
    ? "1 registro"
    : `${expenseItems.length} registros`
);


const expensesContainer =
  document.getElementById(
    "expensesTransactions"
  );


if (expensesContainer) {

  if (!expenseItems.length) {

    expensesContainer.innerHTML = `
      <div class="expenses-empty">
        Nenhum gasto neste período.
      </div>
    `;

  } else {

    expensesContainer.innerHTML =
      expenseItems
        .map(item => {

          const secondary =
            item.category
              ? `${dateFormatter.format(item.date)} • ${escapeHtml(item.category)}`
              : dateFormatter.format(item.date);

          return `
            <div
              class="tx expense-page-tx"
              data-row="${item.row}"
              role="button"
              tabindex="0"
              style="cursor:pointer"
            >

              <div class="dot red"></div>

              <div class="txmain">

                <b>
                  ${escapeHtml(item.description)}
                </b>

                <small>
                  ${secondary}
                </small>

              </div>

              <strong class="red">
                −${money.format(item.value)}
              </strong>

            </div>
          `;
        })
        .join("");


    expensesContainer
      .querySelectorAll(
        ".expense-page-tx"
      )
      .forEach(element => {

        element.addEventListener(
          "click",
          () => {

            const row =
              Number(
                element.dataset.row
              );

            hideExpensesPage();

            openEditModal(row);
          }
        );
      });
  }
}

  const chart =
  document.getElementById(
    "expensesChart"
  );

if (chart) {

  const chartItems =
    [...items]
      .filter(item => {

        const type =
          getType(item.type);

        return (
          type === "expense" ||
          type === "income"
        );
      })
      .sort(
        (a, b) =>
          a.date - b.date
      );


  if (!chartItems.length) {

    chart.innerHTML = `
      <div class="expenses-chart-placeholder">
        Sem movimentações neste período
      </div>
    `;

    setText(
      "expensesChartChange",
      "0 registros"
    );

  } else {

    const dailyData = {};


    chartItems.forEach(item => {

      const key =
        `${item.date.getFullYear()}-${item.date.getMonth()}-${item.date.getDate()}`;

      if (!dailyData[key]) {

        dailyData[key] = {
          date: item.date,
          expense: 0,
          income: 0
        };
      }


      const type =
        getType(item.type);


      if (type === "expense") {

        dailyData[key].expense +=
          item.value;

      } else if (
        type === "income"
      ) {

        dailyData[key].income +=
          item.value;
      }
    });


    const days =
      Object.values(
        dailyData
      )
        .sort(
          (a, b) =>
            a.date - b.date
        );


    let cumulativeExpense = 0;
    let cumulativeIncome = 0;


    const points =
      days.map(day => {

        cumulativeExpense +=
          day.expense;

        cumulativeIncome +=
          day.income;

        return {
          date: day.date,
          expense: cumulativeExpense,
          income: cumulativeIncome
        };
      });


    const maxValue =
      Math.max(
        ...points.map(
          point =>
            Math.max(
              point.expense,
              point.income
            )
        ),
        1
      );


    const width = 600;
    const height = 220;

    const paddingX = 28;
    const paddingTop = 30;
    const paddingBottom = 38;

    const usableWidth =
      width -
      paddingX * 2;

    const usableHeight =
      height -
      paddingTop -
      paddingBottom;


    const makePoints =
      type =>
        points.map(
          (point, index) => {

            const x =
              points.length === 1
                ? width / 2
                : paddingX +
                  (
                    index /
                    (
                      points.length - 1
                    )
                  ) *
                  usableWidth;

            const value =
              point[type];

            const y =
              paddingTop +
              (
                1 -
                value /
                maxValue
              ) *
              usableHeight;

            return {
              ...point,
              x,
              y
            };
          }
        );


    const expensePoints =
      makePoints(
        "expense"
      );

    const incomePoints =
      makePoints(
        "income"
      );


    const expenseLine =
      expensePoints
        .map(
          point =>
            `${point.x},${point.y}`
        )
        .join(" ");


    const incomeLine =
      incomePoints
        .map(
          point =>
            `${point.x},${point.y}`
        )
        .join(" ");


    chart.innerHTML = `

      <div class="chart-legend">

        <span>
          <i class="legend-dot income-dot"></i>
          Entradas
        </span>

        <span>
          <i class="legend-dot expense-dot"></i>
          Gastos
        </span>

      </div>


      <svg
        viewBox="0 0 ${width} ${height}"
        width="100%"
        height="100%"
        preserveAspectRatio="none"
      >

        <polyline
          points="${incomeLine}"
          fill="none"
          stroke="#2ee58a"
          stroke-width="5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />


        <polyline
          points="${expenseLine}"
          fill="none"
          stroke="#ff4f59"
          stroke-width="5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />


        ${incomePoints
          .map(
            point => `
              <circle
                cx="${point.x}"
                cy="${point.y}"
                r="7"
                fill="#2ee58a"
              />
            `
          )
          .join("")}


        ${expensePoints
          .map(
            point => `
              <circle
                cx="${point.x}"
                cy="${point.y}"
                r="7"
                fill="#ff4f59"
              />
            `
          )
          .join("")}


        ${points
          .map(
            (point, index) => {

              const x =
                points.length === 1
                  ? width / 2
                  : paddingX +
                    (
                      index /
                      (
                        points.length - 1
                      )
                    ) *
                    usableWidth;

              return `
                <text
                  x="${x}"
                  y="${height - 10}"
                  fill="#70787e"
                  font-size="15"
                  text-anchor="middle"
                >
                  ${dateFormatter.format(
                    point.date
                  )}
                </text>
              `;
            }
          )
          .join("")}

      </svg>
    `;


    setText(
      "expensesChartChange",
      `${chartItems.length} ${
        chartItems.length === 1
          ? "registro"
          : "registros"
      }`
    );
  }
}
  
  page.classList.add(
    "open"
  );

  document.body.classList.add(
    "modal-open"
  );
}

function hideExpensesPage() {

  const page =
    document.getElementById(
      "expensesPage"
    );

  page?.classList.remove(
    "open"
  );

  document.body.classList.remove(
    "modal-open"
  );
}


document
  .getElementById(
    "openExpenses"
  )
  ?.addEventListener(
    "click",
    showExpensesPage
  );


document
  .getElementById(
    "closeExpenses"
  )
  ?.addEventListener(
    "click",
    hideExpensesPage
  );

/* ABRIR TELA */

function showFixedExpenses() {

  if (!fixedExpensesPage) {
    return;
  }

  renderFixedExpenses();

  fixedExpensesPage
    .classList.add("open");

  document.body
    .classList.add(
      "modal-open"
    );
}


/* FECHAR TELA */

function hideFixedExpenses() {

  if (!fixedExpensesPage) {
    return;
  }

  fixedExpensesPage
    .classList.remove("open");

  document.body
    .classList.remove(
      "modal-open"
    );
}


openFixedExpenses
  ?.addEventListener(
    "click",
    showFixedExpenses
  );


closeFixedExpenses
  ?.addEventListener(
    "click",
    hideFixedExpenses
  );


/* NOVO FIXO */

function openNewFixedModal() {

  editingFixedRow = null;

  if (fixedDescription) {
    fixedDescription.value = "";
  }

  if (fixedValue) {
    fixedValue.value = "";
  }

  if (fixedModalTitle) {

    fixedModalTitle.textContent =
      "Novo gasto fixo";
  }

  if (saveFixedExpense) {

    saveFixedExpense.textContent =
      "Adicionar gasto fixo";
  }

  fixedExpenseModal
    ?.classList.add("open");

  document.body
    .classList.add(
      "modal-open"
    );

  setTimeout(() => {

    fixedDescription
      ?.focus();

  }, 250);
}


addFixedExpense
  ?.addEventListener(
    "click",
    openNewFixedModal
  );


/* EDITAR FIXO */

function openFixedEditModal(row) {

  const item =
    fixedExpenses
      .map(
        normalizeFixedExpense
      )
      .find(
        item =>
          item.row === row
      );


  if (!item) {

    alert(
      "Não foi possível localizar este gasto fixo."
    );

    return;
  }


  editingFixedRow = row;


  if (fixedDescription) {

    fixedDescription.value =
      item.description;
  }


  if (fixedValue) {

    fixedValue.value =
      money.format(
        item.value
      );
  }


  if (fixedModalTitle) {

    fixedModalTitle.textContent =
      "Editar gasto fixo";
  }


  if (saveFixedExpense) {

    saveFixedExpense.textContent =
      "Salvar alterações";
  }


  fixedExpenseModal
    ?.classList.add("open");

  document.body
    .classList.add(
      "modal-open"
    );
}


/* FECHAR MODAL FIXO */

function hideFixedExpenseModal() {

  fixedExpenseModal
    ?.classList.remove("open");

  editingFixedRow = null;

  /*
    A página de gastos fixos
    continua aberta.
  */

  if (
    !fixedExpensesPage
      ?.classList
      .contains("open")
  ) {

    document.body
      .classList.remove(
        "modal-open"
      );
  }
}


closeFixedExpenseModal
  ?.addEventListener(
    "click",
    hideFixedExpenseModal
  );


fixedExpenseModal
  ?.addEventListener(
    "click",
    event => {

      if (
        event.target ===
          fixedExpenseModal
      ) {

        hideFixedExpenseModal();
      }
    }
  );


/* FORMATAR VALOR FIXO */

fixedValue
  ?.addEventListener(
    "input",
    event => {

      const digits =
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


function getFixedValue() {

  if (!fixedValue) {
    return 0;
  }

  const digits =
    fixedValue.value
      .replace(/\D/g, "");

  if (!digits) {
    return 0;
  }

  return Number(digits) / 100;
}


/* SALVAR FIXO */

saveFixedExpense
  ?.addEventListener(
    "click",
    async () => {

      const description =
        fixedDescription
          ?.value
          .trim() || "";

      const value =
        getFixedValue();


      if (!description) {

        alert(
          "Digite uma descrição."
        );

        return;
      }


      if (value <= 0) {

        alert(
          "Digite um valor válido."
        );

        return;
      }


      const isEditing =
        editingFixedRow !== null;


      try {

        saveFixedExpense.disabled =
          true;

        saveFixedExpense.textContent =
          isEditing
            ? "Salvando..."
            : "Adicionando...";


        const payload = {

          action:
            isEditing
              ? "fixed_update"
              : "fixed_create",

          descricao:
            description,

          amount:
            value
        };


        if (isEditing) {

          payload.row =
            editingFixedRow;
        }


        const response =
          await fetch(
            API_URL,
            {

              method: "POST",

              headers: {

                "Content-Type":
                  "text/plain;charset=utf-8"
              },

              body:
                JSON.stringify(
                  payload
                )
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
            "Erro ao salvar gasto fixo."
          );
        }


        hideFixedExpenseModal();

        await loadTransactions();


      } catch (error) {

        console.error(error);

        alert(
          "Não foi possível salvar o gasto fixo. Tente novamente."
        );


      } finally {

        saveFixedExpense.disabled =
          false;

        saveFixedExpense.textContent =
          "Adicionar gasto fixo";
      }
    }
  );


/* EXCLUIR FIXO */

async function deleteFixedExpense(
  row
) {

  const item =
    fixedExpenses
      .map(
        normalizeFixedExpense
      )
      .find(
        item =>
          item.row === row
      );


  const confirmed =
    confirm(
      item
        ? `Excluir "${item.description}"?`
        : "Excluir este gasto fixo?"
    );


  if (!confirmed) {
    return;
  }


  try {

    const response =
      await fetch(
        API_URL,
        {

          method: "POST",

          headers: {

            "Content-Type":
              "text/plain;charset=utf-8"
          },

          body:
            JSON.stringify({

              action:
                "fixed_delete",

              row:
                row
            })
        }
      );


    if (!response.ok) {

      throw new Error(
        "Não foi possível excluir."
      );
    }


    const result =
      await response.json();


    if (!result.success) {

      throw new Error(
        result.error ||
        "Erro ao excluir."
      );
    }


    await loadTransactions();


  } catch (error) {

    console.error(error);

    alert(
      "Não foi possível excluir o gasto fixo. Tente novamente."
    );
  }
}
/* =========================
   ANÁLISES
========================= */

const analyticsPage =
  document.getElementById(
    "analyticsPage"
  );

const navAnalytics =
  document.getElementById(
    "navAnalytics"
  );

const closeAnalytics =
  document.getElementById(
    "closeAnalytics"
  );


function showAnalyticsPage() {

  if (!analyticsPage) {
    return;
  }


  const items =
    transactions
      .map(
        normalizeTransaction
      )
      .filter(item =>
        isInPeriod(
          item.date,
          currentPeriod
        )
      );


  const incomeItems =
    items.filter(
      item =>
        getType(item.type) ===
        "income"
    );


  const expenseItems =
    items.filter(
      item =>
        getType(item.type) ===
        "expense"
    );


  const totalIncome =
    incomeItems.reduce(
      (total, item) =>
        total + item.value,
      0
    );


  const totalExpense =
    expenseItems.reduce(
      (total, item) =>
        total + item.value,
      0
    );


  const fixedTotal =
    fixedExpenses.reduce(
      (total, item) =>
        total +
        parseMoney(
          item.Valor ??
          item.valor ??
          0
        ),
      0
    );


  const balance =
    totalIncome -
    totalExpense -
    fixedTotal;


  setText(
    "analyticsIncome",
    money.format(
      totalIncome
    )
  );


  setText(
    "analyticsExpense",
    money.format(
      totalExpense
    )
  );


  setText(
    "analyticsBalance",
    money.format(
      balance
    )
  );


  /* MAIOR GASTO */

  if (
    expenseItems.length
  ) {

    const largestExpense =
      [...expenseItems]
        .sort(
          (a, b) =>
            b.value - a.value
        )[0];


    setText(
      "analyticsLargestExpense",
      largestExpense.description
    );


    setText(
      "analyticsLargestExpenseValue",
      money.format(
        largestExpense.value
      )
    );

  } else {

    setText(
      "analyticsLargestExpense",
      "—"
    );

    setText(
      "analyticsLargestExpenseValue",
      money.format(0)
    );
  }


  /* CATEGORIA COM MAIOR GASTO */

  const categoryTotals = {};


  expenseItems.forEach(item => {

    const category =
      item.category ||
      "Outros";


    if (
      !categoryTotals[
        category
      ]
    ) {

      categoryTotals[
        category
      ] = 0;
    }


    categoryTotals[
      category
    ] +=
      item.value;
  });


  const categories =
    Object.entries(
      categoryTotals
    );


  if (
    categories.length
  ) {

    categories.sort(
      (a, b) =>
        b[1] - a[1]
    );


    const [
      topCategory,
      topCategoryValue
    ] =
      categories[0];


    setText(
      "analyticsTopCategory",
      topCategory
    );


    setText(
      "analyticsTopCategoryValue",
      money.format(
        topCategoryValue
      )
    );

  } else {

    setText(
      "analyticsTopCategory",
      "—"
    );


    setText(
      "analyticsTopCategoryValue",
      money.format(0)
    );
  }


  analyticsPage
    .classList.add(
      "open"
    );


  document.body
    .classList.add(
      "modal-open"
    );
}


function hideAnalyticsPage() {

  analyticsPage
    ?.classList.remove(
      "open"
    );


  document.body
    .classList.remove(
      "modal-open"
    );
}


navAnalytics
  ?.addEventListener(
    "click",
    showAnalyticsPage
  );


closeAnalytics
  ?.addEventListener(
    "click",
    hideAnalyticsPage
  );

/* =========================
   ANÁLISES
========================= */

const analyticsPage =
  document.getElementById(
    "analyticsPage"
  );

const navAnalytics =
  document.getElementById(
    "navAnalytics"
  );

const closeAnalytics =
  document.getElementById(
    "closeAnalytics"
  );


function showAnalyticsPage() {

  if (!analyticsPage) {
    return;
  }


  const items =
    transactions
      .map(
        normalizeTransaction
      )
      .filter(item =>
        isInPeriod(
          item.date,
          currentPeriod
        )
      );


  const incomeItems =
    items.filter(
      item =>
        getType(item.type) ===
        "income"
    );


  const expenseItems =
    items.filter(
      item =>
        getType(item.type) ===
        "expense"
    );


  const totalIncome =
    incomeItems.reduce(
      (total, item) =>
        total + item.value,
      0
    );


  const totalExpense =
    expenseItems.reduce(
      (total, item) =>
        total + item.value,
      0
    );


  const fixedTotal =
    fixedExpenses.reduce(
      (total, item) =>
        total +
        parseMoney(
          item.Valor ??
          item.valor ??
          0
        ),
      0
    );


  const balance =
    totalIncome -
    totalExpense -
    fixedTotal;


  setText(
    "analyticsIncome",
    money.format(
      totalIncome
    )
  );


  setText(
    "analyticsExpense",
    money.format(
      totalExpense
    )
  );


  setText(
    "analyticsBalance",
    money.format(
      balance
    )
  );


  /* MAIOR GASTO */

  if (
    expenseItems.length
  ) {

    const largestExpense =
      [...expenseItems]
        .sort(
          (a, b) =>
            b.value - a.value
        )[0];


    setText(
      "analyticsLargestExpense",
      largestExpense.description
    );


    setText(
      "analyticsLargestExpenseValue",
      money.format(
        largestExpense.value
      )
    );

  } else {

    setText(
      "analyticsLargestExpense",
      "—"
    );

    setText(
      "analyticsLargestExpenseValue",
      money.format(0)
    );
  }


  /* CATEGORIA COM MAIOR GASTO */

  const categoryTotals = {};


  expenseItems.forEach(item => {

    const category =
      item.category ||
      "Outros";


    if (
      !categoryTotals[
        category
      ]
    ) {

      categoryTotals[
        category
      ] = 0;
    }


    categoryTotals[
      category
    ] +=
      item.value;
  });


  const categories =
    Object.entries(
      categoryTotals
    );


  if (
    categories.length
  ) {

    categories.sort(
      (a, b) =>
        b[1] - a[1]
    );


    const [
      topCategory,
      topCategoryValue
    ] =
      categories[0];


    setText(
      "analyticsTopCategory",
      topCategory
    );


    setText(
      "analyticsTopCategoryValue",
      money.format(
        topCategoryValue
      )
    );

  } else {

    setText(
      "analyticsTopCategory",
      "—"
    );


    setText(
      "analyticsTopCategoryValue",
      money.format(0)
    );
  }


  analyticsPage
    .classList.add(
      "open"
    );


  document.body
    .classList.add(
      "modal-open"
    );
}


function hideAnalyticsPage() {

  analyticsPage
    ?.classList.remove(
      "open"
    );


  document.body
    .classList.remove(
      "modal-open"
    );
}


navAnalytics
  ?.addEventListener(
    "click",
    showAnalyticsPage
  );


closeAnalytics
  ?.addEventListener(
    "click",
    hideAnalyticsPage
  );

/* =========================
   HISTÓRICO / CALENDÁRIO
========================= */

const monthModal =
  document.getElementById(
    "monthModal"
  );

const openCalendar =
  document.getElementById(
    "openCalendar"
  );

const closeCalendar =
  document.getElementById(
    "closeCalendar"
  );

const previousMonth =
  document.getElementById(
    "previousMonth"
  );

const nextMonth =
  document.getElementById(
    "nextMonth"
  );

const selectedMonth =
  document.getElementById(
    "selectedMonth"
  );

const currentMonthButton =
  document.getElementById(
    "currentMonthButton"
  );
const calendarDays =
  document.getElementById(
    "calendarDays"
  );

const showWholeMonth =
  document.getElementById(
    "showWholeMonth"
  );

const monthFormatter =
  new Intl.DateTimeFormat(
    "pt-BR",
    {
      month: "long",
      year: "numeric"
    }
  );


function updateSelectedMonth() {

  if (!selectedMonth) return;

  let text =
    monthFormatter.format(
      selectedDate
    );

  text =
    text.charAt(0).toUpperCase() +
    text.slice(1);

  selectedMonth.textContent =
    text;
}

function renderCalendarDays() {

  if (!calendarDays) {
    return;
  }

  calendarDays.innerHTML = "";


  const year =
    selectedDate.getFullYear();

  const month =
    selectedDate.getMonth();


  const firstDay =
    new Date(
      year,
      month,
      1
    );


  const lastDay =
    new Date(
      year,
      month + 1,
      0
    );


  /*
    Segunda = primeira coluna.
    Domingo = última.
  */

  const offset =
    firstDay.getDay() === 0
      ? 6
      : firstDay.getDay() - 1;


  for (
    let i = 0;
    i < offset;
    i++
  ) {

    const empty =
      document.createElement(
        "div"
      );

    empty.className =
      "calendar-day empty";

    calendarDays.appendChild(
      empty
    );
  }


  const today =
    new Date();


  for (
    let day = 1;
    day <= lastDay.getDate();
    day++
  ) {

    const date =
      new Date(
        year,
        month,
        day
      );


    const button =
      document.createElement(
        "button"
      );

    button.className =
      "calendar-day";

    button.textContent =
      day;


    /* HOJE */

    if (
      date.getDate() ===
        today.getDate() &&
      date.getMonth() ===
        today.getMonth() &&
      date.getFullYear() ===
        today.getFullYear()
    ) {

      button.classList.add(
        "today"
      );
    }


    /* DIA SELECIONADO */

    if (
      selectedDay &&
      date.getDate() ===
        selectedDay.getDate() &&
      date.getMonth() ===
        selectedDay.getMonth() &&
      date.getFullYear() ===
        selectedDay.getFullYear()
    ) {

      button.classList.add(
        "selected"
      );
    }


    /* POSSUI MOVIMENTAÇÕES */

    const hasTransactions =
      transactions
        .map(
          normalizeTransaction
        )
        .some(item => {

          return (
            item.date.getDate() ===
              day &&

            item.date.getMonth() ===
              month &&

            item.date.getFullYear() ===
              year
          );
        });


    if (hasTransactions) {

      button.classList.add(
        "has-transactions"
      );
    }


    /* SELECIONAR DIA */

    button.addEventListener(
      "click",
      () => {

        selectedDay =
          new Date(
            year,
            month,
            day
          );

        selectedDate =
          new Date(
            year,
            month,
            day
          );

        currentPeriod =
          "month";

        document
          .querySelectorAll(
            "[data-period]"
          )
          .forEach(periodButton => {

            periodButton
              .classList.toggle(
                "on",
                periodButton
                  .dataset
                  .period ===
                    "month"
              );
          });

        render();

        closeMonthModal();
      }
    );


    calendarDays.appendChild(
      button
    );
  }
}
function openMonthModal() {

  if (!monthModal) return;

  updateSelectedMonth();
renderCalendarDays();

monthModal.classList.add(
    "open"
  );

  document.body.classList.add(
    "modal-open"
  );
}


function closeMonthModal() {

  if (!monthModal) return;

  monthModal.classList.remove(
    "open"
  );

  document.body.classList.remove(
    "modal-open"
  );
}


function changeMonth(amount) {

  selectedDate =
    new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth() + amount,
      1
    );

  // Remove qualquer dia específico selecionado
  selectedDay = null;

  currentPeriod = "month";

  document
    .querySelectorAll(
      "[data-period]"
    )
    .forEach(button => {

      button.classList.toggle(
        "on",
        button.dataset.period ===
          "month"
      );
    });

  updateSelectedMonth();

  // Atualiza os dias exibidos no calendário
  renderCalendarDays();

  render();
}


openCalendar?.addEventListener(
  "click",
  openMonthModal
);


closeCalendar?.addEventListener(
  "click",
  closeMonthModal
);


previousMonth?.addEventListener(
  "click",
  () => {
    changeMonth(-1);
  }
);


nextMonth?.addEventListener(
  "click",
  () => {
    changeMonth(1);
  }
);

showWholeMonth
  ?.addEventListener(
    "click",
    () => {

      selectedDay = null;

      currentPeriod =
        "month";

      document
        .querySelectorAll(
          "[data-period]"
        )
        .forEach(button => {

          button.classList.toggle(
            "on",
            button.dataset.period ===
              "month"
          );
        });

      render();

      closeMonthModal();
    }
  );
currentMonthButton?.addEventListener(
  "click",
  () => {

    selectedDate =
      new Date();

    selectedDay = null;
    
    currentPeriod =
      "month";

    document
      .querySelectorAll(
        "[data-period]"
      )
      .forEach(button => {

        button.classList.toggle(
          "on",
          button.dataset.period ===
            "month"
        );
      });

    updateSelectedMonth();

    render();

    closeMonthModal();
  }
);


monthModal?.addEventListener(
  "click",
  event => {

    if (
      event.target ===
      monthModal
    ) {
      closeMonthModal();
    }
  }
);


updateSelectedMonth();
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
