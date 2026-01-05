// ✅ src/hooks/useMvpActions.js
import { useState } from "react";
import { mvpApi } from "../api/mvpApi";

export function useMvpActions() {
  const [loading, setLoading] = useState(false);
  const [lastReward, setLastReward] = useState(null);
  const [error, setError] = useState("");

  async function safeRun(fn) {
    try {
      setLoading(true);
      setError("");
      const res = await fn();
      if (res.ok) setLastReward(res.reward);
      else setError(res.error || "Failed");
      return res;
    } catch (err) {
      setError(err.message);
      return { ok: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }

  return {
    loading,
    lastReward,
    error,

    // Fitness
    logWorkout: () => safeRun(() => mvpApi.logWorkout()),
    logWater: () => safeRun(() => mvpApi.logWater()),

    // Study
    addJournal: (title, content) => safeRun(() => mvpApi.addJournal({ title, content })),
    shareTopic: (topic) => safeRun(() => mvpApi.shareTopic({ topic })),

    // Language
    logLanguagePractice: (language_key, recordings) =>
      safeRun(() => mvpApi.logLanguagePractice({ language_key, recordings })),

    // Forms
    submitForm: (form_type, form_data) =>
      safeRun(() => mvpApi.submitForm({ form_type, form_data })),

    // AI
    startAISession: (session_id, summary) =>
      safeRun(() => mvpApi.startAISession({ session_id, summary })),
  };
}
