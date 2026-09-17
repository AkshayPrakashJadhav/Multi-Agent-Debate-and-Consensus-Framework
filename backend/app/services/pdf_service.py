import io
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from app.models.models import DebateSession

class PDFService:
    def generate_debate_report(self, session: DebateSession) -> io.BytesIO:
        """Generates a professional PDF report containing the debate session analysis."""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36
        )
        
        styles = getSampleStyleSheet()
        
        # Define clean, modern color scheme (Navy, Teal, Slate)
        primary_color = colors.HexColor("#1e293b")  # slate-800
        secondary_color = colors.HexColor("#0f766e")  # teal-700
        text_color = colors.HexColor("#334155")  # slate-700
        bg_light = colors.HexColor("#f8fafc")  # slate-50
        border_color = colors.HexColor("#cbd5e1")  # slate-300
        
        title_style = ParagraphStyle(
            name="ReportTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=26,
            textColor=primary_color,
            spaceAfter=15
        )
        
        subtitle_style = ParagraphStyle(
            name="ReportSubTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            textColor=secondary_color,
            spaceAfter=12
        )
        
        body_style = ParagraphStyle(
            name="ReportBody",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=10,
            leading=14,
            textColor=text_color,
            spaceAfter=8
        )
        
        bold_body_style = ParagraphStyle(
            name="ReportBoldBody",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=14,
            textColor=primary_color,
            spaceAfter=8
        )
        
        story = []
        
        # Document Title
        story.append(Paragraph("Decision Support Framework Analysis", title_style))
        story.append(Spacer(1, 10))
        
        # Meta info table
        meta_data = [
            [Paragraph("<b>Domain:</b>", body_style), Paragraph(session.domain, body_style),
             Paragraph("<b>Date:</b>", body_style), Paragraph(session.created_at.strftime('%Y-%m-%d %H:%M'), body_style)],
            [Paragraph("<b>Confidence Score:</b>", body_style), Paragraph(f"{session.confidence_score}%", bold_body_style),
             Paragraph("<b>Debate Rounds:</b>", body_style), Paragraph(str(session.debate_length_rounds), body_style)],
            [Paragraph("<b>Model Cost:</b>", body_style), Paragraph(f"${session.cost}", body_style),
             Paragraph("<b>Tokens Used:</b>", body_style), Paragraph(str(session.tokens_used), body_style)]
        ]
        
        meta_table = Table(meta_data, colWidths=[120, 150, 100, 170])
        meta_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), bg_light),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('GRID', (0,0), (-1,-1), 0.5, border_color),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('LEFTPADDING', (0,0), (-1,-1), 8),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 15))
        
        # Query Section
        story.append(Paragraph("User Query", subtitle_style))
        story.append(Paragraph(f"\"{session.query}\"", body_style))
        story.append(Spacer(1, 15))
        
        # Consensus Answer
        story.append(Paragraph("Final Consensus Answer", subtitle_style))
        story.append(Paragraph(session.consensus_answer or "No answer computed yet.", body_style))
        story.append(Spacer(1, 15))
        
        # Explainability Summary (Executive Summary)
        explain_round = next((r for r in session.rounds if r.agent_name == "Explainability Agent"), None)
        if explain_round:
            try:
                import json
                explain_data = json.loads(explain_round.response)
                story.append(Paragraph("Executive Summary (Plain Language)", subtitle_style))
                story.append(Paragraph(explain_data.get("plainSummary", ""), body_style))
                story.append(Spacer(1, 6))
                
                # Key Reasons
                reasons = explain_data.get("keyReasons", [])
                if reasons:
                    story.append(Paragraph("<b>Key Rationale:</b>", bold_body_style))
                    for reason in reasons:
                        story.append(Paragraph(f"• {reason}", body_style))
                    story.append(Spacer(1, 6))
                    
                # Key Risks
                risks = explain_data.get("keyRisks", [])
                if risks:
                    story.append(Paragraph("<b>Key Risks & Vulnerabilities:</b>", bold_body_style))
                    for risk in risks:
                        story.append(Paragraph(f"• {risk}", body_style))
                    story.append(Spacer(1, 6))
                    
                story.append(Spacer(1, 10))
            except Exception:
                pass
        
        # Debate Timeline
        story.append(Paragraph("Multi-Agent Debate Timeline", subtitle_style))
        
        rounds_to_print = sorted(session.rounds, key=lambda x: (x.round_number, x.agent_name))
        
        for r in rounds_to_print:
            # Skip planner, verifier and other JSON reporting agents from printing raw JSON text
            if r.round_number == 0 or r.agent_name in ["Verifier", "Planner", "Compliance Agent", "Explainability Agent", "Historical Consistency Agent", "Bias Detection Agent"]:
                continue
                
            round_title = f"Round {r.round_number} - {r.agent_name} (Confidence: {r.confidence}%)"
            story.append(Paragraph(f"<b>{round_title}</b>", bold_body_style))
            story.append(Paragraph(r.response, body_style))
            if r.critique:
                story.append(Paragraph(f"<i>Critique/Justification:</i> {r.critique}", body_style))
            story.append(Spacer(1, 10))
            
        # Safety, Bias, & Consistency Audits Section
        has_audits = any(r.agent_name in ["Compliance Agent", "Historical Consistency Agent", "Bias Detection Agent"] for r in session.rounds)
        if has_audits:
            import json
            story.append(Spacer(1, 10))
            story.append(Paragraph("System Audits & Guardrails", subtitle_style))
            
            comp_round = next((r for r in session.rounds if r.agent_name == "Compliance Agent"), None)
            if comp_round:
                try:
                    c_data = json.loads(comp_round.response)
                    story.append(Paragraph(f"<b>Compliance Check:</b> Severity: {c_data.get('severity', 'Low')}", bold_body_style))
                    story.append(Paragraph(f"Recommendation: {c_data.get('recommendation', '')}", body_style))
                    if c_data.get("complianceFlags"):
                        story.append(Paragraph(f"Flags: {', '.join(c_data.get('complianceFlags', []))}", body_style))
                    story.append(Spacer(1, 5))
                except:
                    pass
                    
            const_round = next((r for r in session.rounds if r.agent_name == "Historical Consistency Agent"), None)
            if const_round:
                try:
                    c_data = json.loads(const_round.response)
                    story.append(Paragraph("<b>Temporal Consistency Check:</b>", bold_body_style))
                    story.append(Paragraph(f"Contradiction Detected: {'Yes' if c_data.get('contradictionDetected') else 'No'}", body_style))
                    story.append(Paragraph(c_data.get("explanation", ""), body_style))
                    story.append(Spacer(1, 5))
                except:
                    pass
                    
            bias_round = next((r for r in session.rounds if r.agent_name == "Bias Detection Agent"), None)
            if bias_round:
                try:
                    b_data = json.loads(bias_round.response)
                    story.append(Paragraph("<b>Bias Audit:</b>", bold_body_style))
                    story.append(Paragraph(f"Detected: {', '.join(b_data.get('detectedBiases', [])) or 'None'}", body_style))
                    story.append(Paragraph(b_data.get("explanation", ""), body_style))
                    story.append(Spacer(1, 5))
                except:
                    pass
            
        doc.build(story)
        buffer.seek(0)
        return buffer

pdf_service = PDFService()
