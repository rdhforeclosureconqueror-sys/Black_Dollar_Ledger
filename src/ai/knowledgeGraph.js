// ✅ src/ai/knowledgeGraph.js
import { pool } from "../server.js";
import { notifyAI } from "../utils/aiNotifier.js";

export async function runKnowledgeGraph() {
  console.log("🌐 Running Simba Knowledge Graph + Predictive Engine...");

  // Step 1: Gather holistic snapshots
  const holistic = await pool.query(`
    SELECT member_id, physical_score, mental_score, linguistic_score, cultural_score, overall_health
    FROM ai_holistic_state;
  `);

  for (const h of holistic.rows) {
    const { member_id } = h;

    // Step 2: Insert nodes for latest snapshot
    await pool.query(
      `
      INSERT INTO ai_knowledge_nodes (member_id, category, label, value, context)
      VALUES 
        ($1, 'motion', 'physical_score', $2, '{}'::jsonb),
        ($1, 'journal', 'mental_score', $3, '{}'::jsonb),
        ($1, 'voice', 'linguistic_score', $4, '{}'::jsonb),
        ($1, 'study', 'cultural_score', $5, '{}'::jsonb)
      `,
      [member_id, h.physical_score, h.mental_score, h.linguistic_score, h.cultural_score]
    );

    // Step 3: Analyze trajectory over time
    const trend = await pool.query(
      `
      SELECT AVG(value) AS avg_value, category
      FROM ai_knowledge_nodes
      WHERE member_id=$1
      AND created_at > NOW() - INTERVAL '14 days'
      GROUP BY category;
      `,
      [member_id]
    );

    const trends = Object.fromEntries(trend.rows.map(t => [t.category, t.avg_value]));

    // Step 4: Predict future states
    const risk = predictWellnessRisk(trends);
    const msg = buildPredictionMessage(risk);

    await pool.query(
      `INSERT INTO ai_predictions (member_id, type, confidence, message)
       VALUES ($1,$2,$3,$4)`,
      [member_id, risk.type, risk.confidence, msg]
    );

    // Step 5: Real-time feedback
    notifyAI(member_id, {
      type: "predictive_alert",
      message: msg,
      confidence: risk.confidence,
    });
  }

  console.log("✅ Simba Knowledge Graph completed.");
}

function predictWellnessRisk(trends) {
  const { motion = 0, journal = 0, voice = 0, study = 0 } = trends;
  const avg = (motion + journal + voice + study) / 4;

  if (motion > 70 && avg > 75)
    return { type: "growth_surge", confidence: 0.9 };
  if (journal < 40 && motion < 50)
    return { type: "motivation_drop", confidence: 0.85 };
  if (motion > 85 && journal < 45)
    return { type: "burnout_risk", confidence: 0.8 };
  if (voice > 80 && study > 70)
    return { type: "language_gain", confidence: 0.88 };

  return { type: "stable", confidence: 0.7 };
}

function buildPredictionMessage(risk) {
  switch (risk.type) {
    case "motivation_drop":
      return "🪫 Motivation may be declining. Try journaling or connecting with peers.";
    case "burnout_risk":
      return "🔥 You’re training hard! Take a mindfulness break to recharge.";
    case "growth_surge":
      return "🚀 You’re entering a growth surge! Keep your rhythm balanced.";
    case "language_gain":
      return "🗣️ Language skills improving fast — practice with peers to solidify gains!";
    default:
      return "🌿 You’re stable — maintain your current flow.";
  }
}
