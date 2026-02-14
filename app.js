(function () {
  const analyzeBtn = document.getElementById("analyzeBtn");
  const newRunBtn = document.getElementById("newRunBtn");
  const pdfBtn = document.getElementById("pdfBtn");

  const inputText = document.getElementById("inputText");

  const scoreValue = document.getElementById("scoreValue");
  const riskBadge = document.getElementById("riskBadge");
  const riskText = document.getElementById("riskText");
  const gapsText = document.getElementById("gapsText");
  const bars = document.getElementById("bars");

  const ringEl =
    document.getElementById("scoreRing") || document.querySelector(".score__ring");

  // ✅ يمنع النتائج القديمة من الكتابة فوق الجديدة
  let latestRunId = 0;

  function setRing(score) {
    if (!ringEl) return;
    ringEl.style.setProperty("--p", String(score));
  }

  function animateBars() {
    if (!bars) return;
    bars.classList.remove("is-running");
    void bars.offsetWidth;
    bars.classList.add("is-running");
  }

  function setRiskByScore(score) {
    // 0 قبل التحليل
    if (score === 0) {
      riskBadge.textContent = "لم يتم التحليل بعد";
      riskText.textContent = "—";
      return;
    }

    let label = "تعرض متوسط";
    if (score <= 24) label = "تعرض حرج";
    else if (score <= 49) label = "تعرض مرتفع";
    else if (score <= 74) label = "تعرض متوسط";
    else label = "مستقر";

    riskBadge.textContent = label;
    riskText.textContent = label;
  }

  function setSubsBars(subs) {
    const s = subs || {};
    const values = [
      Number(s["الإحاطة الواجبة"] ?? 0),
      Number(s["الموافقة والعدول"] ?? 0),
      Number(s["الاحتفاظ والإتلاف"] ?? 0),
    ];

    const fills = document.querySelectorAll(".bar__fill");
    values.forEach((val, idx) => {
      const el = fills[idx];
      if (!el) return;
      const safe = Math.max(0, Math.min(100, Number(val) || 0));
      el.style.setProperty("--w", `${safe}%`);
    });

    animateBars();
  }

  function resetUI() {
    scoreValue.textContent = "0";
    gapsText.textContent = "عالي 0 • متوسط 0 • منخفض 0";
    setRing(0);
    setRiskByScore(0);
    setSubsBars({
      "الإحاطة الواجبة": 0,
      "الموافقة والعدول": 0,
      "الاحتفاظ والإتلاف": 0,
    });
  }

  async function runAnalysis() {
    const text = String(inputText?.value || "").trim();

    if (!text) {
      resetUI();
      return;
    }

    const runId = ++latestRunId; // ✅ رقم تشغيل جديد
    ringEl?.classList.add("is-loading");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "ANALYZE_FAILED");

      // ✅ إذا وصلت نتيجة قديمة، تجاهليها
      if (runId !== latestRunId) return;

      const score = Math.max(0, Math.min(100, Number(data.score) || 0));
      const gaps = data.gaps || { high: 0, mid: 0, low: 0 };

      scoreValue.textContent = String(score);
      gapsText.textContent = `عالي ${gaps.high ?? 0} • متوسط ${gaps.mid ?? gaps.med ?? 0} • منخفض ${gaps.low ?? 0}`;

      setRing(score);
      setRiskByScore(score);
      setSubsBars(data.subs);
    } catch (e) {
      // ✅ إذا صار خطأ: نظّفي الواجهة
      resetUI();
      console.error(e);
      alert("تعذر التحليل الآن. تأكدي أن السيرفر يعمل وأن المفتاح لديه رصيد.");
    } finally {
      // ✅ لا تشيلي loading إذا هذا تشغيل قديم
      if (runId === latestRunId) {
        ringEl?.classList.remove("is-loading");
      }
    }
  }

  async function downloadPDF() {
    const text = String(inputText?.value || "").trim();
    if (!text) {
      alert("الصقي نصًا أولاً ثم حمّلي التقرير.");
      return;
    }

    // ✅ (اختياري) إذا تبين PDF دائمًا أحدث نتيجة:
    // await runAnalysis();

    const res = await fetch("/api/report-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err?.error || "تعذر إنشاء PDF");
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "hima-report.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  }

  analyzeBtn?.addEventListener("click", runAnalysis);

  newRunBtn?.addEventListener("click", () => {
    if (inputText) inputText.value = "";
    latestRunId++; // ✅ يلغي أي طلب سابق
    resetUI();
  });

  pdfBtn?.addEventListener("click", downloadPDF);

  // تشغيل نظيف أول ما تفتح الصفحة
  resetUI();
})();