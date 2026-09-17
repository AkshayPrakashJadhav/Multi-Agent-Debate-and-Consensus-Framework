import json
import math
from typing import List, Dict, Any, Tuple
from datetime import datetime, UTC
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.models import DebateSession, DebateRound
from app.services.rag_service import rag_service

# Import OpenAI client if key is set
try:
    import openai
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False

class OpenAIClient:
    """Helper client to invoke LLMs or simulate detailed mock debate outputs."""
    def __init__(self):
        self.api_key = settings.OPENAI_API_KEY
        if HAS_OPENAI and self.api_key:
            openai.api_key = self.api_key
            self.enabled = True
        else:
            self.enabled = False

    def generate(self, system_prompt: str, user_prompt: str, response_format: str = "text") -> str:
        if self.enabled:
            try:
                messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ]
                
                # Format arguments
                kwargs = {
                    "model": "gpt-4o-mini",
                    "messages": messages,
                    "temperature": 0.4,
                }
                if response_format == "json":
                    kwargs["response_format"] = {"type": "json_object"}
                    
                response = openai.chat.completions.create(**kwargs)
                return response.choices[0].message.content
            except Exception as e:
                print(f"OpenAI Call Failed, falling back to simulated output: {e}")
                
        return self.simulate_agent_response(system_prompt, user_prompt)

    def simulate_agent_response(self, system_prompt: str, user_prompt: str) -> str:
        """Simulates detailed reasoning, critiques, and answers based on domain keywords."""
        prompt_combined = (system_prompt + " " + user_prompt).lower()
        
        # Determine agent role
        system_lower = system_prompt.lower()
        role = "generic"
        
        if "planner agent" in system_lower:
            role = "planner"
        elif "research agent" in system_lower:
            role = "research"
        elif "expert agent" in system_lower:
            role = "expert"
        elif "risk analysis agent" in system_lower or "risk analyst" in system_lower:
            role = "risk"
        elif "critical reviewer agent" in system_lower:
            role = "critic"
        elif "devil's advocate agent" in system_lower:
            role = "devil"
        elif "arbiter agent" in system_lower:
            role = "arbiter"
        elif "compliance and ethics agent" in system_lower:
            role = "compliance"
        elif "explainability and summarizer agent" in system_lower:
            role = "explainability"
        elif "historical consistency agent" in system_lower:
            role = "consistency"
        elif "bias detection agent" in system_lower:
            role = "bias"
        elif "verification agent" in system_lower:
            role = "verifier"

        # Extract domain
        domain = "technology"
        for d in ["healthcare", "medical", "finance", "financial", "legal", "law", "education", "teacher"]:
            if d in prompt_combined:
                domain = d
                break

        # Structure response as JSON if requested
        is_json = "json" in system_prompt.lower() or "json" in user_prompt.lower()

        if is_json:
            if "planner" in role:
                return json.dumps({
                    "subtasks": [
                        f"Deconstruct core parameters of {domain} query.",
                        f"Retrieve relevant regulatory compliance criteria for {domain}.",
                        f"Analyze risk profile of proposed options.",
                        f"Evaluate consensus boundary parameters."
                    ],
                    "focus_areas": ["accuracy", "regulatory guidelines", "risk exposure", "consensus"]
                })
            
            elif "research" in role:
                return json.dumps({
                    "answer": f"Research indicates that in {domain} systems, core structural paradigms require careful empirical verification. Studies show 84% reliability under standard operations, though long-tail anomalies still present operational bottlenecks.",
                    "confidence": 85.0,
                    "evidence": ["Academic review (2025) on state-of-the-art implementations", "Baseline bench test reports"],
                    "weaknesses": "Limited test coverage on real-world edge scenarios."
                })
            
            elif "expert" in role:
                return json.dumps({
                    "answer": f"From a specialized {domain} perspective, the primary objective is to maximize throughput while adhering to rigid domain standards. This necessitates deploying robust validation layers and schema structures.",
                    "confidence": 92.0,
                    "evidence": ["Domain expert validation standard v4", "Industry best-practice compliance blueprints"],
                    "weaknesses": "Potential latency overhead from additional schema structures."
                })
                
            elif "risk" in role:
                return json.dumps({
                    "answer": f"The primary operational risks in this {domain} implementation involve integration compatibility, data leakage, and compliance failures under regulatory scrutiny. A mitigation layer must be added.",
                    "confidence": 78.0,
                    "evidence": ["Risk audit checklist for standard frameworks", "Security incident database (2025)"],
                    "weaknesses": "Remediation protocols might slow down system response times."
                })
                
            elif "critic" in role:
                return json.dumps({
                    "critique": f"The Research agent fails to address integration costs. The Expert agent overlooks the latency trade-offs of additional validation schemas, which could lead to critical failure under load.",
                    "confidence": 88.0,
                    "evidence": ["System performance metrics under strain"],
                    "weaknesses": "Requires access to concrete network configuration files to quantify exact overhead."
                })
                
            elif "arbiter" in role:
                return json.dumps({
                    "consensus_answer": f"Synthesizing all inputs for the {domain} query, the consensus indicates a hybrid deployment strategy is best: proceed with standard implementation while installing validation layers, and implement the mitigation protocol recommended by the Risk Analyst.",
                    "confidence_score": 88.5,
                    "justification": f"Balancing the empirical findings of the Research Agent (84% reliability) with the Expert's standards and Risk Agent's alerts yields a resilient solution."
                })
                
            elif "verifier" in role:
                return json.dumps({
                    "veracity_score": 92.0,
                    "supported_claims": ["Research agent cited 84% reliability matching retrieved text.", "Risk agent cited compliance standards."],
                    "unsupported_claims": ["Expert agent cited standard v4, which is not found in retrieved chunks."]
                })
                
            elif "confidence" in role:
                return json.dumps({
                    "calibrated_score": 86.5,
                    "variables": {
                        "agreement_score": 88.0,
                        "source_coverage": 85.0,
                        "contradiction_ratio": 10.0
                    }
                })

            elif "devil" in role:
                return json.dumps({
                    "counterArgument": f"Deliberately challenging the consensus for this {domain} query: there is a severe risk of vendor/technology lock-in and compliance overhead that has been underestimated by the domain expert. A simpler solution might avoid this entire overhead.",
                    "strength": 85.0,
                    "unresolvedRisk": "Loss of operational flexibility and difficulty in rolling back the migration if performance bottlenecks occur under peak loads."
                })
                
            elif "compliance" in role:
                return json.dumps({
                    "complianceFlags": [f"Standard {domain} regulation mismatch", f"Data localization requirements under {domain} guidelines"],
                    "severity": "Medium",
                    "recommendation": f"Perform a comprehensive compliance review of data residency policies and use zero-trust client encryption before final rollout."
                })
                
            elif "explainability" in role:
                return json.dumps({
                    "plainSummary": f"In simple terms, we recommend adopting a hybrid approach to address the {domain} query: proceed with implementation but incorporate the validation standards suggested by the expert while establishing risk boundaries.",
                    "keyReasons": [
                        "Optimizes performance while keeping operational risk within acceptable standards.",
                        "Directly supported by retrieved RAG documentation.",
                        "Prevents groupthink by incorporating devil's advocate suggestions."
                    ],
                    "keyRisks": [
                        "Minor latency increase due to the extra checks.",
                        "Higher initial setup complexity."
                    ]
                })
                
            elif "consistency" in role:
                return json.dumps({
                    "similarPastSessions": [
                        {"query": f"How do we handle standard {domain} architecture migrations?", "consensus_answer": "Use encrypted hybrid clusters with real-time audit controls."}
                    ],
                    "contradictionDetected": False,
                    "explanation": f"The final consensus decision aligns with previous recommendations in the {domain} domain that emphasize hybrid models with safety protocols."
                })
                
            elif "bias" in role:
                return json.dumps({
                    "detectedBiases": ["Technical solution bias (over-focusing on speed vs cost)"],
                    "severity": "Low",
                    "explanation": "The Domain Expert was slightly biased towards technical agility, but this framing was successfully balanced by the Risk Analyst and Arbiter."
                })
                
        # String responses
        return f"Simulated {role} response for {domain} context. This contains extensive analysis of the user query including citations and logical structures."


def model_to_dict(model) -> Dict[str, Any]:
    if not model:
        return {}
    d = {}
    for column in model.__table__.columns:
        val = getattr(model, column.name)
        if isinstance(val, datetime):
            val = val.isoformat()
        d[column.name] = val
    return d

def session_to_dict(session, db: Session) -> Dict[str, Any]:
    d = model_to_dict(session)
    rounds = db.query(DebateRound).filter(DebateRound.session_id == session.id).order_by(DebateRound.round_number, DebateRound.agent_name).all()
    d["rounds"] = [model_to_dict(r) for r in rounds]
    return d

class DebateOrchestrator:
    def __init__(self):
        self.llm = OpenAIClient()

    def run_debate_stream(self, db: Session, user_id: str, query: str, domain: str):
        """Executes the full multi-agent debate and consensus pipeline yielding progress."""
        # 1. Retrieve RAG context
        context_chunks = rag_service.retrieve_context(query, domain)
        context_text = "\n\n".join([f"Source: {c['filename']} (Chunk {c['chunk_index']}): {c['text']}" for c in context_chunks])
        if not context_text:
            context_text = "No domain-specific document uploaded yet. Relying on default models' weights."

        # Initialize debate session record
        session = DebateSession(
            user_id=user_id,
            query=query,
            domain=domain
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        yield {"type": "session_created", "session_id": session.id, "session": session_to_dict(session, db)}

        tokens_used = 0
        total_cost = 0.0

        # ---- PHASE 1: Planner Agent ----
        planner_system = (
            "You are a Planner Agent. Your job is to parse user queries, identify key issues, "
            "and lay out subtasks and focus areas for specialized agents. Output your plan in JSON "
            "format containing keys: 'subtasks' (list of strings) and 'focus_areas' (list of strings)."
        )
        planner_user = f"User query: {query}\nDomain context: {domain}"
        planner_raw = self.llm.generate(planner_system, planner_user, response_format="json")
        tokens_used += 1500  # Estimate
        total_cost += 0.003
        
        try:
            planner_data = json.loads(planner_raw)
        except Exception:
            planner_data = {"subtasks": ["General analysis"], "focus_areas": ["correctness"]}

        # Save Planner output
        planner_round = DebateRound(
            session_id=session.id,
            round_number=0,
            agent_name="Planner",
            response=json.dumps(planner_data),
            confidence=100.0
        )
        db.add(planner_round)
        db.commit()

        yield {"type": "planner_completed", "round": model_to_dict(planner_round)}

        # Agent profiles & systems
        agents = {
            "Research Agent": {
                "system": "You are a Research Agent specializing in academic, historical, and empirical literature. State your answer, confidence (0-100), evidence list, and weaknesses. Return JSON format with keys: 'answer', 'confidence', 'evidence', 'weaknesses'.",
                "weight": 0.32
            },
            "Domain Expert": {
                "system": f"You are a {domain} Expert Agent focusing on industry standards and best practices. State your answer, confidence (0-100), evidence list, and weaknesses. Return JSON format with keys: 'answer', 'confidence', 'evidence', 'weaknesses'.",
                "weight": 0.40
            },
            "Risk Analyst": {
                "system": "You are a Risk Analysis Agent. Identify key weaknesses, failure modes, security hazards, and regulatory liabilities. State your answer, confidence (0-100), evidence list, and weaknesses. Return JSON format with keys: 'answer', 'confidence', 'evidence', 'weaknesses'.",
                "weight": 0.18
            },
            "Critical Reviewer": {
                "system": "You are a Critical Reviewer Agent. Critique other agents' claims, challenge unsupported assertions, and expose logical fallacies. State your critique, confidence (0-100), evidence list, and weaknesses. Return JSON format with keys: 'critique', 'confidence', 'evidence', 'weaknesses'.",
                "weight": 0.10
            }
        }

        # Keep track of debate rounds history
        history: Dict[int, Dict[str, Any]] = {}

        # ---- PHASE 2: Round 1 (Independent Answers) ----
        history[1] = {}
        for agent_name, profile in agents.items():
            user_prompt = (
                f"Query: {query}\n"
                f"Retrieved context:\n{context_text}\n"
                f"Planner guidelines:\n{json.dumps(planner_data)}\n"
                f"Provide your initial analysis."
            )
            raw_response = self.llm.generate(profile["system"], user_prompt, response_format="json")
            tokens_used += 2000
            total_cost += 0.004

            try:
                parsed = json.loads(raw_response)
            except Exception:
                parsed = {
                    "answer": raw_response if "critique" not in agent_name.lower() else "",
                    "critique": raw_response if "critique" in agent_name.lower() else "",
                    "confidence": 80.0,
                    "evidence": [],
                    "weaknesses": "None"
                }

            history[1][agent_name] = parsed
            
            # Save to Database
            db_round = DebateRound(
                session_id=session.id,
                round_number=1,
                agent_name=agent_name,
                response=parsed.get("answer", parsed.get("critique", "")),
                critique=parsed.get("critique", None) if "critique" in agent_name.lower() else None,
                confidence=parsed.get("confidence", 80.0),
                evidence=parsed.get("evidence", []),
                weaknesses=parsed.get("weaknesses", "")
            )
            db.add(db_round)
            db.commit()

            yield {"type": "agent_completed", "round_number": 1, "agent_name": agent_name, "round": model_to_dict(db_round)}
        
        # ---- PHASE 3: Adaptive Debate Loop (Rounds 2 & 3) ----
        max_rounds = 3
        current_round = 2
        consensus_score = 0.0

        while current_round <= max_rounds:
            history[current_round] = {}
            
            # Compile peers' previous round answers
            peers_feedback = ""
            for name, data in history[current_round - 1].items():
                ans = data.get("answer", data.get("critique", ""))
                peers_feedback += f"Agent: {name} (Round {current_round - 1})\nResponse: {ans}\nConfidence: {data.get('confidence')}\nEvidence: {data.get('evidence')}\n\n"

            for agent_name, profile in agents.items():
                user_prompt = (
                    f"Query: {query}\n"
                    f"Retrieved Context:\n{context_text}\n"
                    f"Previous Round Peers Responses:\n{peers_feedback}\n"
                    f"Revise your answer. Critique peers' errors, reflect on your own weaknesses, and output your updated status. Return JSON format."
                )
                raw_response = self.llm.generate(profile["system"], user_prompt, response_format="json")
                tokens_used += 2500
                total_cost += 0.005

                try:
                    parsed = json.loads(raw_response)
                except Exception:
                    parsed = {
                        "answer": raw_response if "critique" not in agent_name.lower() else "",
                        "critique": raw_response if "critique" in agent_name.lower() else "",
                        "confidence": 80.0,
                        "evidence": [],
                        "weaknesses": ""
                    }

                history[current_round][agent_name] = parsed
                
                # Save to database
                db_round = DebateRound(
                    session_id=session.id,
                    round_number=current_round,
                    agent_name=agent_name,
                    response=parsed.get("answer", parsed.get("critique", "")),
                    critique=parsed.get("critique", None) if "critique" in agent_name.lower() else None,
                    confidence=parsed.get("confidence", 80.0),
                    evidence=parsed.get("evidence", []),
                    weaknesses=parsed.get("weaknesses", "")
                )
                db.add(db_round)
                db.commit()

                yield {"type": "agent_completed", "round_number": current_round, "agent_name": agent_name, "round": model_to_dict(db_round)}

            # Calculate Consensus Variance between agents' confidence levels
            confidences = [data.get("confidence", 80.0) for data in history[current_round].values()]
            mean_conf = sum(confidences) / len(confidences)
            variance = sum((c - mean_conf) ** 2 for c in confidences) / len(confidences)
            std_dev = math.sqrt(variance)
            
            # Simple agreement index: less spread in confidences & higher scores mean consensus is forming
            consensus_score = max(0.0, 100.0 - (std_dev * 2.5))
            
            yield {"type": "round_completed", "round_number": current_round, "consensus_score": consensus_score}

            # Adaptive stopping condition
            if consensus_score >= 90.0:
                break
                
            current_round += 1

        final_rounds_executed = current_round if current_round <= max_rounds else max_rounds
        current_step_round = final_rounds_executed + 1

        # ---- PHASE 3.5: Devil's Advocate Agent (Consensus check) ----
        devils_advocate_run = False
        devils_advocate_response = ""
        devils_advocate_strength = 0.0
        devils_advocate_risk = ""

        # Trigger if consensus looks stable but not absolute (70% < score < 90%)
        if 70.0 < consensus_score < 90.0:
            devils_advocate_system = (
                "You are the Devil's Advocate Agent. The current debate has reached a converging consensus. "
                "Your job is to deliberately argue the strongest opposing case, challenge the consensus, expose hidden flaws, "
                "and suggest unresolved risks. Even if you personally agree, you MUST construct a logical and forceful counter-argument. "
                "Return JSON format with keys: 'counterArgument', 'strength' (0-100), and 'unresolvedRisk'."
            )
            # Compile debate trace so far
            transcript_so_far = ""
            for r_num in range(1, final_rounds_executed + 1):
                transcript_so_far += f"Round {r_num}:\n"
                for name, data in history[r_num].items():
                    transcript_so_far += f"[{name}]: {data.get('answer', data.get('critique', ''))}\n"
            
            devils_advocate_user = f"Query: {query}\nDomain context: {domain}\nPeer transcript:\n{transcript_so_far}"
            da_raw = self.llm.generate(devils_advocate_system, devils_advocate_user, response_format="json")
            tokens_used += 2500
            total_cost += 0.005

            try:
                da_data = json.loads(da_raw)
            except Exception:
                da_data = {
                    "counterArgument": da_raw,
                    "strength": 80.0,
                    "unresolvedRisk": "Potential workflow bottlenecks."
                }
            
            devils_advocate_run = True
            devils_advocate_response = da_data.get("counterArgument", "")
            devils_advocate_strength = float(da_data.get("strength", 80.0))
            devils_advocate_risk = da_data.get("unresolvedRisk", "")

            # Save Devil's Advocate Round
            da_round_model = DebateRound(
                session_id=session.id,
                round_number=current_step_round,
                agent_name="Devil's Advocate",
                response=devils_advocate_response,
                critique=devils_advocate_risk,
                confidence=devils_advocate_strength
            )
            db.add(da_round_model)
            db.commit()

            yield {"type": "devils_advocate_completed", "round": model_to_dict(da_round_model)}
            current_step_round += 1

        # ---- PHASE 4: Arbiter Agent ----
        arbiter_system = (
            "You are the Arbiter Agent. Read the complete debate transcript (including the Devil's Advocate counter-argument if present). "
            "Synthesize a single, comprehensive final answer. Explain the trade-offs, why the decision was selected, "
            "and compute a consensus score. Return JSON format with keys: 'consensus_answer', 'confidence_score', 'justification'."
        )
        
        transcript = ""
        for r_num in range(1, final_rounds_executed + 1):
            transcript += f"--- ROUND {r_num} ---\n"
            for name, data in history[r_num].items():
                ans = data.get("answer", data.get("critique", ""))
                transcript += f"[{name}]: {ans}\n"
        if devils_advocate_run:
            transcript += f"--- DEVIL'S ADVOCATE COUNTER-ARGUMENT ---\n[Devil's Advocate]: {devils_advocate_response}\nRisk flagged: {devils_advocate_risk}\n"
        
        arbiter_user = f"Query: {query}\nTranscript:\n{transcript}\nContext:\n{context_text}"
        arbiter_raw = self.llm.generate(arbiter_system, arbiter_user, response_format="json")
        tokens_used += 3000
        total_cost += 0.006

        try:
            arbiter_data = json.loads(arbiter_raw)
        except Exception:
            arbiter_data = {
                "consensus_answer": arbiter_raw,
                "confidence_score": 85.0,
                "justification": "Direct synthesis of agent transcripts."
            }

        arbiter_round_model = DebateRound(
            session_id=session.id,
            round_number=current_step_round,
            agent_name="Arbiter",
            response=arbiter_data.get("consensus_answer", ""),
            critique=arbiter_data.get("justification", ""),
            confidence=arbiter_data.get("confidence_score", 85.0)
        )
        db.add(arbiter_round_model)
        db.commit()

        yield {"type": "arbiter_completed", "round": model_to_dict(arbiter_round_model)}
        current_step_round += 1

        # ---- PHASE 4.1: Compliance / Ethics Agent ----
        compliance_system = (
            f"You are the Compliance and Ethics Agent specializing in the {domain} domain. "
            "Review the proposed final consensus decision for regulatory, compliance, and ethical issues "
            "(e.g., HIPAA/GDPR for Healthcare, SEBI/RBI/SEC for Finance, SOC2/GDPR for Technology, standard guidelines for Education or Legal). "
            "Identify flags, severity (Low/Medium/High), and recommendations. "
            "Return JSON format with keys: 'complianceFlags' (list of strings), 'severity', 'recommendation'."
        )
        compliance_user = f"Proposed Decision: {arbiter_data.get('consensus_answer')}\nRetrieved Context:\n{context_text}"
        comp_raw = self.llm.generate(compliance_system, compliance_user, response_format="json")
        tokens_used += 2000
        total_cost += 0.004

        try:
            comp_data = json.loads(comp_raw)
        except Exception:
            comp_data = {
                "complianceFlags": [],
                "severity": "Low",
                "recommendation": "Standard procedural guidelines verified."
            }

        comp_round_model = DebateRound(
            session_id=session.id,
            round_number=current_step_round,
            agent_name="Compliance Agent",
            response=json.dumps(comp_data),
            confidence=100.0
        )
        db.add(comp_round_model)
        db.commit()

        yield {"type": "compliance_completed", "round": model_to_dict(comp_round_model)}
        current_step_round += 1

        # ---- PHASE 4.2: Explainability Agent ----
        explainability_system = (
            "You are the Explainability and Summarizer Agent. Translate the technical final consensus decision "
            "and the debate trace into a simple, plain-language summary for non-expert users. "
            "Return JSON format with keys: 'plainSummary' (string), 'keyReasons' (list of 3 strings), 'keyRisks' (list of 2 strings)."
        )
        explainability_user = f"Consensus Answer: {arbiter_data.get('consensus_answer')}\nJustification: {arbiter_data.get('justification')}\nTranscript:\n{transcript}"
        exp_raw = self.llm.generate(explainability_system, explainability_user, response_format="json")
        tokens_used += 2500
        total_cost += 0.005

        try:
            exp_data = json.loads(exp_raw)
        except Exception:
            exp_data = {
                "plainSummary": "A hybrid deployment approach is recommended to balance standards with security risks.",
                "keyReasons": ["Improves stability", "Maintains compliance standards", "Provides structured audit logs"],
                "keyRisks": ["Requires extra validation latency", "Slightly higher cost overhead"]
            }

        exp_round_model = DebateRound(
            session_id=session.id,
            round_number=current_step_round,
            agent_name="Explainability Agent",
            response=json.dumps(exp_data),
            confidence=100.0
        )
        db.add(exp_round_model)
        db.commit()

        yield {"type": "explainability_completed", "round": model_to_dict(exp_round_model)}
        current_step_round += 1

        # ---- PHASE 4.3: Historical Consistency Agent ----
        past_sessions = db.query(DebateSession).filter(
            DebateSession.domain == domain,
            DebateSession.id != session.id,
            DebateSession.consensus_answer != None
        ).order_by(DebateSession.created_at.desc()).limit(3).all()
        
        past_context = ""
        for p_sess in past_sessions:
            past_context += f"Past Query: {p_sess.query}\nPast Answer: {p_sess.consensus_answer}\n\n"

        consistency_system = (
            f"You are the Historical Consistency Agent. Compare the current query and consensus decision with prior debate sessions in the same {domain} domain. "
            "Identify if there are any direct contradictions or inconsistencies with previous sessions. "
            "Return JSON format with keys: 'similarPastSessions' (list of dicts with 'query' and 'consensus_answer'), 'contradictionDetected' (bool), and 'explanation' (string)."
        )
        consistency_user = f"Current Query: {query}\nCurrent Consensus: {arbiter_data.get('consensus_answer')}\nPast Sessions:\n{past_context or 'No prior sessions found.'}"
        const_raw = self.llm.generate(consistency_system, consistency_user, response_format="json")
        tokens_used += 2000
        total_cost += 0.004

        try:
            const_data = json.loads(const_raw)
        except Exception:
            const_data = {
                "similarPastSessions": [{"query": p.query, "consensus_answer": p.consensus_answer} for p in past_sessions],
                "contradictionDetected": False,
                "explanation": "No prior contradictory sessions found in the database. Stance remains stable."
            }

        const_round_model = DebateRound(
            session_id=session.id,
            round_number=current_step_round,
            agent_name="Historical Consistency Agent",
            response=json.dumps(const_data),
            confidence=100.0
        )
        db.add(const_round_model)
        db.commit()

        yield {"type": "consistency_completed", "round": model_to_dict(const_round_model)}
        current_step_round += 1

        # ---- PHASE 4.4: Bias Detection Agent ----
        bias_system = (
            "You are the Bias Detection Agent. Scan the debate arguments of all agents for cognitive biases, skewed framing, "
            "or overweighting of a specific stakeholder group. "
            "Return JSON format with keys: 'detectedBiases' (list of strings), 'severity' (Low/Medium/High), and 'explanation'."
        )
        bias_user = f"Debate Transcript:\n{transcript}"
        bias_raw = self.llm.generate(bias_system, bias_user, response_format="json")
        tokens_used += 2000
        total_cost += 0.004

        try:
            bias_data = json.loads(bias_raw)
        except Exception:
            bias_data = {
                "detectedBiases": ["Technical solutions bias"],
                "severity": "Low",
                "explanation": "No high severity biases detected. Domain Expert focuses on throughput, Risk Analyst balances this with security parameters."
            }

        bias_round_model = DebateRound(
            session_id=session.id,
            round_number=current_step_round,
            agent_name="Bias Detection Agent",
            response=json.dumps(bias_data),
            confidence=100.0
        )
        db.add(bias_round_model)
        db.commit()

        yield {"type": "bias_completed", "round": model_to_dict(bias_round_model)}
        current_step_round += 1

        # ---- PHASE 5: Verification Agent ----
        verifier_system = (
            "You are the Verification Agent. Compare the Arbiter's consensus answer against "
            "the source RAG context documents. Identify supported and unsupported claims. "
            "Return JSON format with keys: 'veracity_score' (0-100), 'supported_claims' (list), 'unsupported_claims' (list)."
        )
        verifier_user = f"Arbiter Answer: {arbiter_data.get('consensus_answer')}\nSource Context:\n{context_text}"
        verifier_raw = self.llm.generate(verifier_system, verifier_user, response_format="json")
        tokens_used += 2000
        total_cost += 0.004
        
        try:
            verifier_data = json.loads(verifier_raw)
        except Exception:
            verifier_data = {
                "veracity_score": 90.0,
                "supported_claims": ["Basic model facts verify."],
                "unsupported_claims": []
            }

        verifier_round_model = DebateRound(
            session_id=session.id,
            round_number=current_step_round,
            agent_name="Verifier",
            response=json.dumps(verifier_data),
            confidence=verifier_data.get("veracity_score", 90.0)
        )
        db.add(verifier_round_model)
        db.commit()

        yield {"type": "verifier_completed", "round": model_to_dict(verifier_round_model)}

        # ---- PHASE 6: Confidence Estimator Engine ----
        calibrated_confidence = round(
            (0.4 * arbiter_data.get("confidence_score", 85.0)) + 
            (0.3 * verifier_data.get("veracity_score", 90.0)) + 
            (0.3 * consensus_score), 
            1
        )

        # ---- PHASE 7: Dynamic Agent Influence Score Calculation ----
        def compute_jaccard_similarity(text1: str, text2: str) -> float:
            words1 = set(text1.lower().split())
            words2 = set(text2.lower().split())
            if not words1 or not words2:
                return 0.0
            return len(words1.intersection(words2)) / len(words1.union(words2))

        consensus_answer = arbiter_data.get("consensus_answer", "")
        agent_raw_influences = {}
        
        # Calculate raw similarities
        for name, profile in agents.items():
            last_round_data = history[final_rounds_executed].get(name, {})
            ans_text = last_round_data.get("answer", last_round_data.get("critique", ""))
            sim = compute_jaccard_similarity(ans_text, consensus_answer)
            agent_raw_influences[name] = sim * profile["weight"]
            
        if devils_advocate_run:
            sim = compute_jaccard_similarity(devils_advocate_response, consensus_answer)
            agent_raw_influences["Devil's Advocate"] = sim * 0.15

        # Normalize to sum up to 100
        total_raw = sum(agent_raw_influences.values())
        if total_raw == 0:
            total_raw = 1.0
        normalized_influences = {}
        for k, v in agent_raw_influences.items():
            normalized_influences[k] = round((v / total_raw) * 100, 1)

        # Update Session totals
        session.consensus_answer = consensus_answer
        session.confidence_score = calibrated_confidence
        session.cost = round(total_cost, 4)
        session.tokens_used = tokens_used
        session.debate_length_rounds = final_rounds_executed
        session.agent_influence = normalized_influences
        db.commit()
        db.refresh(session)

        yield {"type": "session_complete", "session": session_to_dict(session, db)}

    def run_debate(self, db: Session, user_id: str, query: str, domain: str) -> DebateSession:
        """Executes the debate pipeline synchronously (consuming the stream generator)."""
        generator = self.run_debate_stream(db, user_id, query, domain)
        session_id = None
        for event in generator:
            if event.get("type") == "session_created":
                session_id = event.get("session_id")
        
        if session_id:
            return db.query(DebateSession).filter(DebateSession.id == session_id).first()
        raise Exception("Failed to orchestrate debate session.")

debate_orchestrator = DebateOrchestrator()
