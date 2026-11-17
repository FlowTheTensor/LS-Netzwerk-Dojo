/* =============================================================================
   farbschema.js – Schalter hell/dunkel (gleich in allen Lernsituationen)
   -----------------------------------------------------------------------------
   Setzt am <html>-Element die Klasse "dunkelmodus" oder "hellmodus".
   Die Wahl wird unter demselben Schlüssel wie in den anderen Lernsituationen
   gespeichert und gilt damit für alle. Ohne gespeicherte Wahl gilt
   STANDARD (siehe unten); "system" folgt der Einstellung des Betriebssystems.
   Im <head> laden, damit beim Öffnen nichts aufblitzt.
   ============================================================================= */
(function () {
  "use strict";
  var SCHLUESSEL = "jps-lernsituationen-farbschema";
  var STANDARD = document.documentElement.getAttribute("data-farbschema-standard") || "system";
  var MOND =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
  var SONNE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/></svg>';

  function gespeichert() {
    try {
      var v = localStorage.getItem(SCHLUESSEL);
      if (v === "dunkel" || v === "hell") {
        return v === "dunkel";
      }
    } catch (e) {
      // kein Speicher verfügbar – Standard nehmen
    }
    if (STANDARD === "dunkel") {
      return true;
    }
    if (STANDARD === "hell") {
      return false;
    }
    return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  }

  var dunkel = gespeichert();
  var knoepfe = [];

  function anwenden() {
    var html = document.documentElement;
    html.classList.toggle("dunkelmodus", dunkel);
    html.classList.toggle("hellmodus", !dunkel);
    html.style.colorScheme = dunkel ? "dark" : "light";
    var titel = dunkel ? "Zum hellen Farbschema wechseln" : "Zum dunklen Farbschema wechseln";
    knoepfe.forEach(function (b) {
      b.innerHTML = dunkel ? SONNE : MOND;
      b.title = titel;
      b.setAttribute("aria-label", titel);
    });
    document.dispatchEvent(new CustomEvent("farbschemawechsel", { detail: { dunkel: dunkel } }));
  }

  function wechseln() {
    dunkel = !dunkel;
    try {
      localStorage.setItem(SCHLUESSEL, dunkel ? "dunkel" : "hell");
    } catch (e) {
      // ohne Speicher gilt die Wahl nur bis zum Neuladen
    }
    anwenden();
  }

  // Knopf einsetzen: vorne in jedes Element mit [data-farbschema-platz]
  function knoepfeEinsetzen() {
    var plaetze = document.querySelectorAll("[data-farbschema-platz]");
    Array.prototype.forEach.call(plaetze, function (platz) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "farbschema-knopf";
      b.addEventListener("click", function () {
        wechseln();
        b.blur();
      });
      platz.insertBefore(b, platz.firstChild);
      knoepfe.push(b);
    });
    anwenden();
  }

  anwenden();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", knoepfeEinsetzen);
  } else {
    knoepfeEinsetzen();
  }
  window.farbschema = {
    istDunkel: function () {
      return dunkel;
    },
    wechseln: wechseln,
  };
})();
