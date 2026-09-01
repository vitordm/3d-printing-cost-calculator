const form = document.getElementById("calculatorForm");
const extraCosts = document.getElementById("extraCosts");
const advancedEnabled = document.getElementById("advancedEnabled");
const advancedFields = document.getElementById("advancedFields");
const STORAGE_KEY = "calculator3d-data-v1";
const printerSelector = document.getElementById("printerSelector");
const printerSelect = document.getElementById("printerSelect");
const filamentOptions = document.getElementById("filamentOptions");
const supportedFilaments = ["PLA", "PETG", "TPU", "ABS", "OTHER"];
let printers = [];
let selectedFilament = "PLA";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

function number(id) {
  const value = document.getElementById(id).value.replace(",", ".");
  return Number.parseFloat(value) || 0;
}

function applyTheme(theme) {
  const root = document.documentElement;
  let actual = theme;

  if (theme === "system") {
    actual = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  root.setAttribute("data-bs-theme", actual);
  localStorage.setItem("calculator3d-theme", theme);
}

function updateFilamentButtons() {
  filamentOptions.querySelectorAll(".filament-option").forEach(button => {
    const isSelected = button.dataset.filament === selectedFilament;
    button.classList.toggle("active", isSelected);
    button.classList.toggle("btn-filament-selected", isSelected);
    button.classList.toggle("btn-outline-filament", !isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
}

function applyPrinterConsumption() {
  const printer = printers.find(item => item.id === printerSelect.value);
  const consumption = printer?.energyConsumption?.[selectedFilament];

  if (selectedFilament !== "OTHER" && typeof consumption === "number") {
    document.getElementById("printerPower").value = consumption;
    saveFormData();
  }
}

async function loadPrinters() {
  try {
    const response = await fetch("./printers/printers.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    printers = Array.isArray(data)
      ? data.filter(printer => printer?.id && printer?.name && printer?.energyConsumption)
      : [];

    if (!printers.length) {
      return;
    }

    printers.forEach(printer => {
      const option = document.createElement("option");
      const textContent = (printer.name?.trim() || `${printer.brand || ""} ${printer.model || ""}`).trim();
      option.value = printer.id;
      option.textContent = textContent;
      printerSelect.appendChild(option);
    });

    printerSelector.classList.remove("d-none");
    printerSelect.addEventListener("change", () => {
      applyPrinterConsumption();
      saveFormData();
    });
  } catch (error) {
    printerSelector.classList.add("d-none");
    console.warn("Não foi possível carregar as impressoras cadastradas.", error);
  }
}

function saveFormData() {
  const fields = {};

  form.querySelectorAll("input[id], select[id], textarea[id]").forEach(field => {
    fields[field.id] = field.type === "checkbox"
      ? field.checked
      : field.value;
  });

  const data = {
    fields,
    filament: selectedFilament,
    extraCosts: Array.from(extraCosts.querySelectorAll(".cost-item")).map(row => ({
      name: row.querySelector(".cost-name").value,
      value: row.querySelector(".cost-value").value
    }))
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn("Não foi possível salvar os dados da calculadora.", error);
  }
}

function loadFormData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return false;
    }

    const data = JSON.parse(saved);
    if (!data || typeof data !== "object" || typeof data.fields !== "object") {
      return false;
    }

    Object.entries(data.fields).forEach(([id, value]) => {
      const field = document.getElementById(id);
      if (!field) {
        return;
      }

      if (field.type === "checkbox") {
        field.checked = Boolean(value);
      } else if (typeof value === "string" || typeof value === "number") {
        field.value = String(value);
      }
    });

    if (supportedFilaments.includes(data.filament)) {
      selectedFilament = data.filament;
      updateFilamentButtons();
    }

    extraCosts.replaceChildren();
    if (Array.isArray(data.extraCosts)) {
      data.extraCosts.forEach(cost => {
        if (cost && typeof cost === "object") {
          addCost(
            typeof cost.name === "string" ? cost.name : "",
            typeof cost.value === "string" || typeof cost.value === "number"
              ? String(cost.value)
              : ""
          );
        }
      });
    }

    advancedFields.classList.toggle("d-none", !advancedEnabled.checked);
    return true;
  } catch (error) {
    console.warn("Não foi possível carregar os dados salvos da calculadora.", error);
    return false;
  }
}

document.querySelectorAll(".theme-option").forEach(button => {
  button.addEventListener("click", () => applyTheme(button.dataset.theme));
});

filamentOptions.querySelectorAll(".filament-option").forEach(button => {
  button.addEventListener("click", () => {
    selectedFilament = button.dataset.filament;
    updateFilamentButtons();
    applyPrinterConsumption();
    saveFormData();
  });
});

window.matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", () => {
    if ((localStorage.getItem("calculator3d-theme") || "system") === "system") {
      applyTheme("system");
    }
  });

advancedEnabled.addEventListener("change", () => {
  advancedFields.classList.toggle("d-none", !advancedEnabled.checked);
});

function addCost(name = "", value = "") {
  const row = document.createElement("div");
  row.className = "row g-2 mb-2 cost-item";

  row.innerHTML = `
    <div class="col-7 col-md-8">
      <input type="text" class="form-control cost-name" placeholder="Ex.: Embalagem" value="${escapeHtml(name)}">
    </div>
    <div class="col-5 col-md-3">
      <div class="input-group">
        <span class="input-group-text">R$</span>
        <input type="number" class="form-control cost-value" min="0" step=".01" value="${escapeHtml(value)}">
      </div>
    </div>
    <div class="col-12 col-md-1">
      <button type="button" class="btn btn-outline-danger remove-cost w-100" title="Remover">
        <i class="bi bi-trash"></i>
      </button>
    </div>
  `;

  row.querySelector(".remove-cost").addEventListener("click", () => {
    row.remove();
    saveFormData();
  });
  extraCosts.appendChild(row);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

document.getElementById("addCost").addEventListener("click", () => addCost());

form.addEventListener("input", saveFormData);
form.addEventListener("change", saveFormData);

function calculate() {
  const filamentPrice = number("filamentPrice");
  const grams = number("materialUsed");
  const duration = number("duration");
  const unit = document.getElementById("durationUnit").value;
  const watts = number("printerPower");
  const kwhPrice = number("energyPrice");
  const margin = Math.min(number("profitMargin"), 99.99);

  const hours = unit === "minutes" ? duration / 60 : duration;

  // Desperdício é aplicado somente sobre o custo do material.
  const waste = advancedEnabled.checked ? number("wastePercent") : 0;
  const effectiveGrams = grams * (1 + waste / 100);

  const materialCost = (filamentPrice / 1000) * effectiveGrams;
  const energyCost = (watts / 1000) * hours * kwhPrice;

  let depreciationCost = 0;
  let maintenanceCost = 0;
  let laborCost = 0;
  let extras = 0;

  if (advancedEnabled.checked) {
    const printerCost = number("printerCost");
    const printerLife = number("printerLife");
    const maintenancePerHour = number("maintenancePerHour");
    const laborRate = number("laborRate");
    const laborHours = number("laborHours");

    depreciationCost = printerLife > 0
      ? (printerCost / printerLife) * hours
      : 0;

    maintenanceCost = maintenancePerHour * hours;
    laborCost = laborRate * laborHours;

    document.querySelectorAll(".cost-value").forEach(input => {
      extras += Number.parseFloat(input.value.replace(",", ".")) || 0;
    });

    document.querySelectorAll(".result-extracosts").forEach(el => el.classList.remove("d-none"));
  } else {
    document.querySelectorAll(".result-extracosts").forEach(el => el.classList.add("d-none"));
  }

  const totalCost =
    materialCost +
    energyCost +
    depreciationCost +
    maintenanceCost +
    laborCost +
    extras;

  // Margem real:
  // preço = custo / (1 - margem)
  const finalPrice = margin >= 100
    ? totalCost
    : totalCost / (1 - margin / 100);

  const profit = finalPrice - totalCost;
  const costPerGram = grams > 0 ? totalCost / grams : 0;

  document.getElementById("materialCost").textContent = currency.format(materialCost);
  document.getElementById("energyCost").textContent = currency.format(energyCost);
  document.getElementById("depreciationCost").textContent = currency.format(depreciationCost);
  document.getElementById("maintenanceCost").textContent = currency.format(maintenanceCost);
  document.getElementById("laborCost").textContent = currency.format(laborCost);
  document.getElementById("extrasCost").textContent = currency.format(extras);
  document.getElementById("totalCost").textContent = currency.format(totalCost);
  document.getElementById("finalPrice").textContent = currency.format(finalPrice);
  document.getElementById("profitValue").textContent = `Lucro: ${currency.format(profit)}`;
  document.getElementById("costPerGram").textContent = currency.format(costPerGram);

  document.getElementById("results").classList.remove("d-none");
}

form.addEventListener("submit", event => {
  event.preventDefault();
  saveFormData();
  calculate();
});



if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(console.error);
  });
}
