/* 돈셈랩 (DonsemLab) — 공통 UI 스크립트 */
(function () {
  "use strict";

  /* ---------- 숫자 도우미 ---------- */
  var DS = (window.DS = window.DS || {});

  DS.toInt = function (value) {
    if (value === null || value === undefined) return 0;
    var digits = String(value).replace(/[^0-9-]/g, "");
    if (digits === "" || digits === "-") return 0;
    var n = Number(digits);
    return isFinite(n) ? n : 0;
  };

  /** 소수점을 살려서 읽는다(시급·이자율·근무시간 등) */
  DS.toNum = function (value) {
    if (value === null || value === undefined) return 0;
    var cleaned = String(value).replace(/,/g, "").replace(/[^0-9.\-]/g, "");
    var n = parseFloat(cleaned);
    return isFinite(n) ? n : 0;
  };

  DS.won = function (n) {
    if (!isFinite(n)) return "0원";
    return Math.round(n).toLocaleString("ko-KR") + "원";
  };

  DS.num = function (n) {
    if (!isFinite(n)) return "0";
    return Math.round(n).toLocaleString("ko-KR");
  };

  DS.wonShort = function (n) {
    var abs = Math.abs(n);
    if (abs >= 100000000) {
      var eok = n / 100000000;
      return (Math.round(eok * 100) / 100).toFixed(eok >= 10 ? 1 : 2).replace(/\.0+$/, "") + "억 원";
    }
    if (abs >= 10000) {
      var man = n / 10000;
      return (Math.round(man * 10) / 10).toFixed(1).replace(/\.0$/, "") + "만 원";
    }
    return DS.won(n);
  };

  DS.pct = function (n, digits) {
    if (!isFinite(n)) n = 0;
    return n.toFixed(digits === undefined ? 2 : digits) + "%";
  };

  /** 10원 미만 절사(원천징수 실무 방식) */
  DS.floor10 = function (n) {
    return Math.floor(n / 10) * 10;
  };

  DS.$ = function (id) {
    return document.getElementById(id);
  };

  DS.value = function (id) {
    var el = DS.$(id);
    return el ? DS.toInt(el.value) : 0;
  };

  DS.text = function (id, value) {
    var el = DS.$(id);
    if (el) el.textContent = value;
  };

  DS.html = function (id, value) {
    var el = DS.$(id);
    if (el) el.innerHTML = value;
  };

  DS.show = function (id, visible) {
    var el = DS.$(id);
    if (el) el.hidden = !visible;
  };

  /* ---------- 콤마 입력 ---------- */
  function formatComma(el) {
    var raw = el.value;
    var caretFromEnd = raw.length - (el.selectionStart === null ? raw.length : el.selectionStart);
    var digits = raw.replace(/[^0-9]/g, "");
    if (digits.length > 1) digits = digits.replace(/^0+/, "");
    el.value = digits ? Number(digits).toLocaleString("ko-KR") : "";
    try {
      var pos = el.value.length - caretFromEnd;
      el.setSelectionRange(pos, pos);
    } catch (e) {
      /* setSelectionRange 미지원 무시 */
    }
  }

  function initCommaInputs() {
    document.querySelectorAll("[data-format='comma']").forEach(function (el) {
      el.addEventListener("input", function () {
        formatComma(el);
        if (typeof el._onChange === "function") el._onChange();
      });
      el.addEventListener("blur", function () {
        formatComma(el);
      });
    });
  }

  /* ---------- 모바일 메뉴 ---------- */
  function initNav() {
    var toggle = document.querySelector(".nav-toggle");
    var nav = document.getElementById("site-nav");
    if (!toggle || !nav) return;

    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
    });

    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---------- 탭 ---------- */
  function initTabs() {
    document.querySelectorAll("[data-tabs]").forEach(function (group) {
      var buttons = Array.prototype.slice.call(group.querySelectorAll("[role='tab']"));
      if (!buttons.length) return;

      function activate(btn) {
        buttons.forEach(function (b) {
          var selected = b === btn;
          b.setAttribute("aria-selected", selected ? "true" : "false");
          b.setAttribute("tabindex", selected ? "0" : "-1");
          var panel = document.getElementById(b.getAttribute("aria-controls"));
          if (panel) panel.hidden = !selected;
        });
      }

      buttons.forEach(function (btn, i) {
        btn.addEventListener("click", function () {
          activate(btn);
        });
        btn.addEventListener("keydown", function (e) {
          var next = null;
          if (e.key === "ArrowRight") next = buttons[(i + 1) % buttons.length];
          if (e.key === "ArrowLeft") next = buttons[(i - 1 + buttons.length) % buttons.length];
          if (next) {
            e.preventDefault();
            next.focus();
            activate(next);
          }
        });
      });
    });
  }

  /* ---------- 접이식 상세 표 ---------- */
  function initDisclosure() {
    document.querySelectorAll("details[data-lazy]").forEach(function (d) {
      d.addEventListener("toggle", function () {
        if (d.open && typeof d._onOpen === "function") {
          d._onOpen();
        }
      });
    });
  }

  /* ---------- 초기화 ---------- */
  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  ready(function () {
    initNav();
    initTabs();
    initCommaInputs();
    initDisclosure();
    if (typeof window.DSInit === "function") window.DSInit();
  });
})();
