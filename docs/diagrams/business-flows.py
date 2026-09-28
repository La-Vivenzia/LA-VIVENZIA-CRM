"""Builds docs/LA-VIVENZIA-CRM-Business-Flows.pdf — five end-to-end business flow block diagrams
for the founder presentation. Pure reportlab canvas drawing; A4 landscape; La Vivenzia palette.

Every block reflects functionality implemented in packages/twenty-apps/internal/lavivenzia-crm
(capture methods, lifecycle statuses, onboarding steps/statuses, document verification, assignment
factors, SLA rules, notification kinds, intelligence types). Items that are not built are tagged
PLANNED / FUTURE.

    python docs/diagrams/business-flows.py
"""
from __future__ import annotations

import os
from dataclasses import dataclass

from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.utils import simpleSplit
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

# ---------------------------------------------------------------- palette / fonts
PINE = HexColor('#1F4D3A')
SAGE = HexColor('#6B846F')
GOLD = HexColor('#D4AF37')
SAND = HexColor('#F3EFE7')
CHAR = HexColor('#1A1A1A')
GREY = HexColor('#8A8A8A')
LINE = HexColor('#C9CFC9')
SAND_DARK = HexColor('#E6DFD0')
PINE_TINT = Color(0.12, 0.30, 0.23, alpha=0.06)

FONTS = 'C:/Windows/Fonts'
pdfmetrics.registerFont(TTFont('Serif', f'{FONTS}/GARA.TTF'))
pdfmetrics.registerFont(TTFont('Serif-B', f'{FONTS}/GARABD.TTF'))
pdfmetrics.registerFont(TTFont('Serif-I', f'{FONTS}/GARAIT.TTF'))
pdfmetrics.registerFont(TTFont('Sans', f'{FONTS}/segoeui.ttf'))
pdfmetrics.registerFont(TTFont('Sans-B', f'{FONTS}/segoeuib.ttf'))
pdfmetrics.registerFont(TTFont('Sans-L', f'{FONTS}/segoeuil.ttf'))
pdfmetrics.registerFont(TTFont('Sans-SL', f'{FONTS}/segoeuisl.ttf'))

W, H = landscape(A4)  # 841.89 x 595.28
OUT = os.path.join(os.path.dirname(__file__), '..', 'LA-VIVENZIA-CRM-Business-Flows.pdf')

# Block kinds — the legend on page 7 explains exactly these.
KINDS = {
    'auto': dict(fill=PINE, stroke=PINE, text=white, dash=None),          # Automated
    'ai': dict(fill=SAGE, stroke=SAGE, text=white, dash=None),            # AI-assisted (suggestion)
    'human': dict(fill=white, stroke=GOLD, text=CHAR, dash=None),         # Human action
    'event': dict(fill=SAND, stroke=SAGE, text=CHAR, dash=None),          # System event / record
    'future': dict(fill=white, stroke=GREY, text=GREY, dash=(3, 3)),      # Planned / future
}


@dataclass
class Box:
    x: float
    y: float  # top-left, y measured from the TOP of the page
    w: float
    h: float

    @property
    def cx(self):
        return self.x + self.w / 2

    @property
    def cy(self):
        return self.y + self.h / 2

    def pt(self, side: str):
        return {
            'top': (self.cx, self.y), 'bottom': (self.cx, self.y + self.h),
            'left': (self.x, self.cy), 'right': (self.x + self.w, self.cy),
        }[side]


class Page:
    def __init__(self, c: canvas.Canvas):
        self.c = c

    # y-flip helper: our coordinates are top-left based
    def Y(self, y):
        return H - y

    # ---------------------------------------------------------------- primitives
    def text(self, x, y, s, font='Sans', size=8, color=CHAR, align='left'):
        c = self.c
        c.setFont(font, size)
        c.setFillColor(color)
        if align == 'center':
            c.drawCentredString(x, self.Y(y), s)
        elif align == 'right':
            c.drawRightString(x, self.Y(y), s)
        else:
            c.drawString(x, self.Y(y), s)

    def para(self, x, y, w, s, font='Sans', size=8, color=CHAR, leading=None, align='left'):
        leading = leading or size * 1.25
        lines = simpleSplit(s, font, size, w)
        for i, line in enumerate(lines):
            self.text(x + (w / 2 if align == 'center' else 0), y + size + i * leading, line, font, size, color, align)
        return len(lines) * leading

    def block(self, b: Box, title, sub=None, kind='auto', tag=None, size=8.2, subsize=6.6, radius=4, bold=True):
        """A diagram block: title (bold) + optional sub text + optional small tag chip (top-right)."""
        st = KINDS[kind]
        c = self.c
        c.setLineWidth(1.1 if kind != 'human' else 1.4)
        c.setStrokeColor(st['stroke'])
        c.setFillColor(st['fill'])
        if st['dash']:
            c.setDash(*st['dash'])
        c.roundRect(b.x, self.Y(b.y + b.h), b.w, b.h, radius, stroke=1, fill=1)
        c.setDash()
        if kind == 'ai':  # thin gold accent stripe at the top identifies AI-assisted blocks
            c.setFillColor(GOLD)
            c.rect(b.x + radius, self.Y(b.y + 2.2), b.w - 2 * radius, 2.2, stroke=0, fill=1)
        pad = 6
        font = 'Sans-B' if bold else 'Sans'
        title_lines = simpleSplit(title, font, size, b.w - 2 * pad)
        sub_lines = simpleSplit(sub, 'Sans', subsize, b.w - 2 * pad) if sub else []
        total = len(title_lines) * size * 1.2 + (len(sub_lines) * subsize * 1.22 + 2 if sub_lines else 0)
        y = b.y + (b.h - total) / 2 + size * 0.95
        for line in title_lines:
            self.text(b.cx, y, line, font, size, st['text'], 'center')
            y += size * 1.2
        y += 2
        sub_color = st['text'] if kind in ('auto', 'ai') else (GREY if kind != 'future' else GREY)
        if kind in ('auto', 'ai'):
            sub_color = Color(1, 1, 1, alpha=0.88)
        for line in sub_lines:
            self.text(b.cx, y, line, 'Sans', subsize, sub_color, 'center')
            y += subsize * 1.22
        if tag:
            self.chip(b.x + b.w - 4, b.y - 5, tag, anchor='right')

    def chip(self, x, y, label, anchor='left', fill=GOLD, color=CHAR, size=5.6):
        c = self.c
        w = pdfmetrics.stringWidth(label, 'Sans-B', size) + 8
        h = 9.5
        x0 = x - w if anchor == 'right' else x
        c.setFillColor(fill)
        c.setStrokeColor(fill)
        c.roundRect(x0, self.Y(y + h), w, h, 3, stroke=0, fill=1)
        self.text(x0 + w / 2, y + h - 2.6, label, 'Sans-B', size, color, 'center')

    def diamond(self, b: Box, title, sub=None, size=7.8):
        c = self.c
        p = c.beginPath()
        p.moveTo(b.cx, self.Y(b.y)); p.lineTo(b.x + b.w, self.Y(b.cy)); p.lineTo(b.cx, self.Y(b.y + b.h)); p.lineTo(b.x, self.Y(b.cy)); p.close()
        c.setLineWidth(1.4); c.setStrokeColor(PINE); c.setFillColor(white)
        c.drawPath(p, stroke=1, fill=1)
        lines = simpleSplit(title, 'Sans-B', size, b.w * 0.62)
        y = b.cy - (len(lines) * size * 1.2) / 2 + size * 0.9 - (5 if sub else 0)
        for line in lines:
            self.text(b.cx, y, line, 'Sans-B', size, PINE, 'center'); y += size * 1.2
        if sub:
            self.text(b.cx, y + 1, sub, 'Sans', 6.2, GREY, 'center')

    def arrow(self, p1, p2, color=PINE, width=1.0, head=4.2, label=None, label_dy=-3, dash=None, route=None, label_at=None):
        """Straight or orthogonal (route = list of intermediate points) arrow with a filled head."""
        c = self.c
        pts = [p1] + (route or []) + [p2]
        c.setStrokeColor(color); c.setLineWidth(width)
        if dash:
            c.setDash(*dash)
        path = c.beginPath()
        path.moveTo(pts[0][0], self.Y(pts[0][1]))
        for q in pts[1:]:
            path.lineTo(q[0], self.Y(q[1]))
        c.drawPath(path, stroke=1, fill=0)
        c.setDash()
        # head on last segment
        (ax, ay), (bx, by) = pts[-2], pts[-1]
        dx, dy = bx - ax, by - ay
        length = max((dx * dx + dy * dy) ** 0.5, 0.001)
        ux, uy = dx / length, dy / length
        px, py = -uy, ux
        hp = c.beginPath()
        hp.moveTo(bx, self.Y(by))
        hp.lineTo(bx - ux * head + px * head * 0.55, self.Y(by - uy * head + py * head * 0.55))
        hp.lineTo(bx - ux * head - px * head * 0.55, self.Y(by - uy * head - py * head * 0.55))
        hp.close()
        c.setFillColor(color)
        c.drawPath(hp, stroke=0, fill=1)
        if label:
            mx, my = label_at or ((ax + bx) / 2, (ay + by) / 2 + label_dy)
            self.text(mx, my, label, 'Sans-B', 6, GOLD if color == GOLD else SAGE, 'center')

    def connect(self, a: Box, b: Box, side_a='right', side_b='left', **kw):
        self.arrow(a.pt(side_a), b.pt(side_b), **kw)

    def group(self, b: Box, label=None, fill=None, stroke=LINE, label_color=SAGE, dash=(2, 2), label_font='Sans-B', label_size=6.4):
        c = self.c
        c.setLineWidth(0.8); c.setStrokeColor(stroke)
        if dash:
            c.setDash(*dash)
        if fill is not None:
            c.setFillColor(fill)
        c.roundRect(b.x, self.Y(b.y + b.h), b.w, b.h, 6, stroke=1, fill=1 if fill is not None else 0)
        c.setDash()
        if label:
            self.text(b.x + 8, b.y + 10, label.upper(), label_font, label_size, label_color)

    def column_header(self, x, w, label, index):
        c = self.c
        y = 74
        c.setFillColor(PINE); c.rect(x, self.Y(y + 15), w, 15, stroke=0, fill=1)
        self.text(x + w / 2, y + 10.8, f'{index}   {label.upper()}', 'Sans-B', 6.8, white, 'center')

    def hline(self, x1, x2, y, color=LINE, width=0.6):
        self.c.setStrokeColor(color); self.c.setLineWidth(width); self.c.line(x1, self.Y(y), x2, self.Y(y))

    # ---------------------------------------------------------------- chrome
    def header(self, number, title, subtitle):
        c = self.c
        self.text(28, 36, f'DIAGRAM {number}', 'Sans-B', 7, GOLD)
        self.text(28, 56, title, 'Serif-B', 19, PINE)
        self.text(W - 28, 36, subtitle, 'Sans-SL', 8.4, CHAR, 'right')
        self.text(W - 28, 52, 'LA VIVENZIA CRM  ·  END-TO-END BUSINESS FLOWS', 'Sans', 6.5, GREY, 'right')
        self.hline(28, W - 28, 63, GOLD, 0.9)

    def footer(self, page, note=None):
        self.hline(28, W - 28, H - 26, LINE, 0.5)
        self.text(28, H - 15, 'La Vivenzia · Founder presentation · September 2026 · Source of truth: implemented CRM (packages/twenty-apps/internal/lavivenzia-crm)', 'Sans', 6, GREY)
        self.text(W - 28, H - 15, f'{page} / 7', 'Sans', 6.5, GREY, 'right')
        if note:
            self.text(W / 2, H - 15, note, 'Sans', 6, GREY, 'center')

    def mini_legend(self, x, y):
        items = [('auto', 'Automated'), ('ai', 'AI-assisted'), ('human', 'Human action'), ('event', 'System event / record'), ('future', 'Planned / future')]
        for kind, label in items:
            st = KINDS[kind]
            self.c.setFillColor(st['fill']); self.c.setStrokeColor(st['stroke']); self.c.setLineWidth(1)
            if st['dash']:
                self.c.setDash(*st['dash'])
            self.c.roundRect(x, self.Y(y + 7), 9, 7, 1.5, stroke=1, fill=1)
            self.c.setDash()
            self.text(x + 13, y + 6.2, label, 'Sans', 6.2, CHAR)
            x += 13 + pdfmetrics.stringWidth(label, 'Sans', 6.2) + 12
        # decision glyph
        p = self.c.beginPath(); cx, cy = x + 4.5, y + 3.5
        p.moveTo(cx, self.Y(cy - 4)); p.lineTo(cx + 4.5, self.Y(cy)); p.lineTo(cx, self.Y(cy + 4)); p.lineTo(cx - 4.5, self.Y(cy)); p.close()
        self.c.setStrokeColor(PINE); self.c.setFillColor(white); self.c.setLineWidth(1); self.c.drawPath(p, stroke=1, fill=1)
        self.text(x + 13, y + 6.2, 'Decision', 'Sans', 6.2, CHAR)


# ================================================================== pages
def cover(pg: Page):
    c = pg.c
    c.setFillColor(SAND); c.rect(0, 0, W, H, stroke=0, fill=1)
    c.setFillColor(PINE); c.rect(0, 0, 18, H, stroke=0, fill=1)
    c.setFillColor(GOLD); c.rect(18, 0, 2, H, stroke=0, fill=1)
    pg.text(70, 150, 'LA VIVENZIA', 'Sans-B', 9, GOLD)
    pg.text(70, 210, 'LA VIVENZIA CRM', 'Serif-B', 44, PINE)
    pg.text(70, 250, 'End-to-End Business Flows', 'Serif', 28, CHAR)
    pg.hline(70, 330, 272, GOLD, 1.2)
    pg.text(70, 298, 'How the CRM captures, manages, onboards and grows relationships', 'Sans-SL', 12.5, CHAR)
    rows = [
        ('1', 'Lead Capture → Qualification → Assignment'),
        ('2', 'Lead → Interaction → Follow-up → Conversion'),
        ('3', 'Onboarding → Document Verification → Approval'),
        ('4', 'CRM Intelligence → Next Best Action'),
        ('5', 'Complete La Vivenzia Relationship Lifecycle'),
    ]
    y = 350
    for n, t in rows:
        pg.text(70, y, n, 'Serif-B', 11, GOLD)
        pg.text(90, y, t, 'Sans', 10, CHAR)
        y += 19
    pg.text(70, H - 60, 'Prepared for Tejas Natani and Ashish  ·  Founder presentation  ·  September 2026', 'Sans', 8, GREY)
    pg.text(70, H - 46, 'Every block reflects functionality implemented in the CRM today; items not yet built are marked PLANNED / FUTURE.', 'Sans', 8, GREY)
    # right-hand quiet mark: five stage tiles
    x0 = W - 300
    stages = ['Capture', 'Engage', 'Onboard', 'Verify', 'Grow']
    for i, s in enumerate(stages):
        b = Box(x0 + i * 54, 200, 46, 46)
        c.setFillColor(PINE if i % 2 == 0 else SAGE); c.roundRect(b.x, pg.Y(b.y + b.h), b.w, b.h, 4, stroke=0, fill=1)
        pg.text(b.cx, b.cy + 3, s, 'Sans-B', 7.2, white, 'center')
        if i < 4:
            pg.arrow((b.x + b.w + 1, b.cy), (b.x + b.w + 7, b.cy), GOLD, 1.2, 3.5)


def columns(pg: Page, labels, x0=28, gap=8, top=74, bottom=404):
    """Five phase columns across the page; returns list of (x, w)."""
    total = W - 2 * x0
    w = (total - gap * (len(labels) - 1)) / len(labels)
    cols = []
    for i, label in enumerate(labels):
        x = x0 + i * (w + gap)
        pg.column_header(x, w, label, i + 1)
        pg.c.setFillColor(PINE_TINT if i % 2 == 0 else Color(1, 1, 1, 0)); pg.c.rect(x, pg.Y(bottom), w, bottom - (top + 15), stroke=0, fill=1)
        cols.append((x, w))
    return cols


def diagram1(pg: Page):
    pg.header(1, 'Lead Capture → Qualification → Assignment', 'From a lead discovered in the field to a lead sitting in an employee\'s workspace')
    cols = columns(pg, ['Input', 'CRM process', 'Decision · AI · human', 'Output', 'Next stage'], bottom=416)
    (x1, w1), (x2, w2), (x3, w3), (x4, w4), (x5, w5) = cols
    bh = 34
    # --- column 1: input
    a1 = Box(x1 + 8, 104, w1 - 16, bh); pg.block(a1, 'Lead discovered', 'field team · social media · referral · event', 'event')
    a2 = Box(x1 + 8, 160, w1 - 16, 92); pg.block(a2, 'Source captured', 'Instagram profile / post · website · LinkedIn · referral · partner referral · WhatsApp chat screenshot · visiting card · brochure / flyer / poster · walk-in · phone · manual · CSV import', 'human', tag='HUMAN')
    ex = Box(x1 + 8, 292, w1 - 16, 96)
    pg.group(ex, 'Example', fill=white, stroke=GOLD, dash=None, label_color=GOLD)
    pg.para(ex.x + 8, ex.y + 16, ex.w - 16, 'Aaranya Trails & Stays', 'Serif-B', 10, PINE)
    pg.para(ex.x + 8, ex.y + 31, ex.w - 16, 'Raj Malhotra · Founder & Owner\nBoutique stay · Lonavala\nSource: Instagram (@aaranyatrails)\nPriority: High · Languages: EN / HI / MR', 'Sans', 6.8, CHAR, leading=9.4)
    pg.connect(a1, a2, 'bottom', 'top')
    # --- column 2: process
    b1 = Box(x2 + 8, 104, w2 - 16, bh + 2); pg.block(b1, 'Lead capture screen', 'one form for every method · under 30 seconds', 'human', tag='HUMAN')
    b2 = Box(x2 + 8, 162, w2 - 16, 46); pg.block(b2, 'OCR / data extraction', 'cards, brochures and screenshots read by AI vision; handles & websites read automatically', 'ai', tag='AI')
    b3 = Box(x2 + 8, 226, w2 - 16, 46); pg.block(b3, 'Field review', 'employee confirms or edits every field · completeness % and hints shown', 'human', tag='HUMAN')
    b4 = Box(x2 + 8, 290, w2 - 16, 52); pg.block(b4, 'Category classification', 'category / sub-category suggested (Stay › Boutique stay, 95 %) — employee confirms', 'ai', tag='AI')
    b5 = Box(x2 + 8, 362, w2 - 16, 42); pg.block(b5, 'Duplicate detection', 'phone · email · handle · name matched against existing leads and partners', 'auto')
    for p, q in [(b1, b2), (b2, b3), (b3, b4), (b4, b5)]:
        pg.connect(p, q, 'bottom', 'top')
    pg.arrow(a2.pt('right'), b1.pt('left'), route=[((a2.x + a2.w + b1.x) / 2, a2.cy), ((a2.x + a2.w + b1.x) / 2, b1.cy)])
    # --- column 3: decision
    d1 = Box(x3 + 6, 118, w3 - 12, 64); pg.diamond(d1, 'Possible duplicate?', 'similarity shown')
    d2 = Box(x3 + 8, 212, w3 - 16, 42); pg.block(d2, 'Link · merge · keep separate', 'employee decides — never automatic', 'human', tag='HUMAN')
    d3 = Box(x3 + 8, 282, w3 - 16, 42); pg.block(d3, 'Confirm & create', 'human confirmation required for every non-manual capture', 'human', tag='HUMAN')
    d4 = Box(x3 + 8, 352, w3 - 16, 48); pg.block(d4, 'Lead intelligence', 'opportunity score · data quality · next best action — rule-based, transparent factors', 'auto')
    pg.arrow(b5.pt('right'), d1.pt('left'), route=[(b5.x + b5.w + 4, b5.cy), (b5.x + b5.w + 4, d1.cy)])
    pg.arrow(d1.pt('bottom'), d2.pt('top'), label='YES', label_at=(d1.cx + 12, d1.y + d1.h + 14))
    pg.arrow((d1.x + d1.w, d1.cy), d3.pt('right'), route=[(d3.x + d3.w + 3, d1.cy), (d3.x + d3.w + 3, d3.cy)], label='NO', label_at=(d3.x + d3.w + 3, d1.cy - 4))
    pg.connect(d2, d3, 'bottom', 'top')
    pg.connect(d3, d4, 'bottom', 'top')
    # --- column 4: output
    o1 = Box(x4 + 8, 104, w4 - 16, bh); pg.block(o1, 'Lead created', 'audit event · capture provenance kept', 'event')
    o2 = Box(x4 + 8, 160, w4 - 16, bh); pg.block(o2, 'Unique LV Lead ID', 'e.g. LV-000002 — never reused', 'auto')
    o3 = Box(x4 + 8, 216, w4 - 16, 54); pg.block(o3, 'Assignment engine', 'category · geography · language · expertise · existing relationship · round-robin — or self-assign / manual', 'auto')
    o4 = Box(x4 + 8, 290, w4 - 16, 42); pg.block(o4, 'Employee assigned', 'accepts, declines or reassigns · assignment history kept', 'human', tag='HUMAN')
    o5 = Box(x4 + 8, 352, w4 - 16, 48); pg.block(o5, 'Notification', 'in-app + email "Lead assigned" · first-contact task created · SLA clock "New lead contact" started', 'event')
    for p, q in [(o1, o2), (o2, o3), (o3, o4), (o4, o5)]:
        pg.connect(p, q, 'bottom', 'top')
    pg.arrow(d4.pt('right'), o1.pt('left'), route=[(o1.x - 4, d4.cy), (o1.x - 4, o1.cy)])
    # --- column 5: next
    n1 = Box(x5 + 8, 104, w5 - 16, 66); pg.block(n1, 'Lead enters employee workspace', 'My Dashboard · Follow-up queue · Lead 360 with next action, score and timeline', 'event')
    n2 = Box(x5 + 8, 200, w5 - 16, 56); pg.block(n2, 'Diagram 2', 'Lead → Interaction → Follow-up → Conversion', 'auto', bold=True)
    pg.arrow(o5.pt('right'), n1.pt('left'), route=[(o5.x + o5.w + 4, o5.cy), (o5.x + o5.w + 4, n1.cy)])
    pg.connect(n1, n2, 'bottom', 'top')
    # human approval note
    note = Box(x5 + 8, 288, w5 - 16, 112)
    pg.group(note, 'Human approval points', fill=white, stroke=GOLD, dash=None, label_color=GOLD)
    pg.para(note.x + 8, note.y + 16, note.w - 16, '1  Field review — nothing is saved unread\n2  Duplicate decision\n3  Confirm & create\n4  Accept / decline assignment\n\nAI only suggests; it never creates, merges or assigns on its own.', 'Sans', 6.8, CHAR, leading=9.6)
    # statuses band
    pg.hline(28, W - 28, 424, LINE, 0.5)
    pg.text(28, 440, 'LEAD STATUS DURING THIS FLOW', 'Sans-B', 6.4, SAGE)
    stat = ['Discovered', 'New', 'Qualifying', 'Assigned']
    x = 28
    for i, s in enumerate(stat):
        b = Box(x, 448, 92, 22); pg.block(b, s, None, 'event', size=7.6, bold=False)
        if i < 3:
            pg.arrow((b.x + b.w, b.cy), (b.x + b.w + 12, b.cy))
        x += 104
    pg.para(x + 8, 448, W - 28 - x - 8, 'Every capture, review, duplicate decision, creation and assignment writes an audit event (who, what, when, outcome). Capture works from a phone: a lead can be captured in the field in under a minute and completed later at the desk.', 'Sans', 6.8, GREY, leading=9.4)
    pg.mini_legend(28, 500)
    pg.footer(2)


def diagram2(pg: Page):
    pg.header(2, 'Lead → Interaction → Follow-up → Conversion', 'The employee\'s daily loop:  SEE → CONTACT → RECORD → FOLLOW UP → PROGRESS')
    cols = columns(pg, ['See  (input)', 'Contact  (CRM process)', 'Record  (human + AI)', 'Follow up  (output)', 'Progress  (next stage)'], bottom=386)
    (x1, w1), (x2, w2), (x3, w3), (x4, w4), (x5, w5) = cols
    bh = 36
    # SEE
    s1 = Box(x1 + 8, 104, w1 - 16, bh); pg.block(s1, 'Assigned lead', 'notification received · lead in My Dashboard', 'event')
    s2 = Box(x1 + 8, 160, w1 - 16, bh + 4); pg.block(s2, 'Employee opens Lead 360', 'one page: profile, timeline, tasks, SLAs, onboarding, intelligence', 'human', tag='HUMAN')
    s3 = Box(x1 + 8, 220, w1 - 16, bh + 10); pg.block(s3, 'Next best action', 'e.g. "Follow up — documents pending, overdue 1 day" · reasons shown', 'auto')
    s4 = Box(x1 + 8, 286, w1 - 16, bh + 10); pg.block(s4, 'Today\'s queue', 'tasks due · overdue follow-ups · SLA due soon · daily briefing', 'auto')
    for p, q in [(s1, s2), (s2, s3), (s3, s4)]:
        pg.connect(p, q, 'bottom', 'top')
    # CONTACT
    c1 = Box(x2 + 8, 104, w2 - 16, bh + 10); pg.block(c1, 'Call · WhatsApp · Email · Meeting', 'the conversation happens on the phone / WhatsApp / in person — outside the CRM', 'human', tag='HUMAN')
    c2 = Box(x2 + 8, 174, w2 - 16, bh + 16); pg.block(c2, 'Communication assistant', 'drafts a WhatsApp follow-up, meeting follow-up or onboarding reminder from the timeline — employee edits and sends it themselves', 'ai', tag='AI')
    c3 = Box(x2 + 8, 250, w2 - 16, bh + 6); pg.block(c3, 'Message sending from the CRM', 'WhatsApp / Instagram transport not connected in V1', 'future', tag='PLANNED / FUTURE')
    pg.arrow(s3.pt('right'), c1.pt('left'), route=[(s3.x + s3.w + 4, s3.cy), (s3.x + s3.w + 4, c1.cy)])
    pg.connect(c2, c1, 'top', 'bottom')
    # RECORD
    r1 = Box(x3 + 8, 104, w3 - 16, bh + 16); pg.block(r1, 'Interaction recorded', 'channel · direction · purpose · outcome · sentiment · commitments · objections · next action · next follow-up date', 'human', tag='HUMAN')
    r2 = Box(x3 + 8, 176, w3 - 16, bh); pg.block(r2, 'Timeline updated', 'interaction history on the lead, visible to the whole team', 'auto')
    r3 = Box(x3 + 8, 232, w3 - 16, bh + 4); pg.block(r3, 'Conversation summary', 'summary, key points, commitments; objections become problem suggestions', 'ai', tag='AI')
    r4 = Box(x3 + 8, 292, w3 - 16, bh + 6); pg.block(r4, 'Lead status updated', 'Contacted → Engaged → Interested — governed lifecycle, reason required for negative outcomes', 'human', tag='HUMAN')
    for p, q in [(r1, r2), (r2, r3), (r3, r4)]:
        pg.connect(p, q, 'bottom', 'top')
    pg.arrow(c1.pt('right'), r1.pt('left'), route=[(c1.x + c1.w + 4, c1.cy), (c1.x + c1.w + 4, r1.cy)])
    # FOLLOW UP
    f1 = Box(x4 + 8, 104, w4 - 16, bh + 4); pg.block(f1, 'Next action generated', 'from the recorded next step · overrides the old one', 'auto')
    f2 = Box(x4 + 8, 164, w4 - 16, bh + 4); pg.block(f2, 'Follow-up task scheduled', 'task with due date created automatically; views: Today · Overdue · Upcoming', 'auto')
    f3 = Box(x4 + 8, 224, w4 - 16, bh + 12); pg.block(f3, 'Notifications & SLA', '"Follow-up due / overdue" · SLA clocks "New lead contact", "Interested follow-up" — due soon → breached → escalated to the owner', 'event')
    f4 = Box(x4 + 8, 292, w4 - 16, bh + 4); pg.block(f4, 'Response received', 'inbound interaction logged · "Lead replied" notification · SLA resolved', 'event')
    for p, q in [(f1, f2), (f2, f3), (f3, f4)]:
        pg.connect(p, q, 'bottom', 'top')
    pg.arrow(r4.pt('right'), f1.pt('left'), route=[(r4.x + r4.w + 4, r4.cy), (r4.x + r4.w + 4, f1.cy)])
    # PROGRESS
    p1 = Box(x5 + 6, 104, w5 - 12, 64); pg.diamond(p1, 'Qualified & interested?', 'employee judgement')
    p2 = Box(x5 + 8, 192, w5 - 16, bh + 8); pg.block(p2, 'Onboarding initiated', 'from Lead 360 · reviewer assigned · checklist sent', 'human', tag='HUMAN')
    p4 = Box(x5 + 8, 252, w5 - 16, bh + 2); pg.block(p4, 'Diagram 3', 'Onboarding → Verification → Approval', 'auto')
    p3 = Box(x5 + 8, 318, w5 - 16, bh + 12); pg.block(p3, 'Keep nurturing', 'Follow up later · No response · Not interested (reason kept) · Dormant', 'human', tag='HUMAN')
    pg.arrow(f4.pt('right'), p1.pt('left'), route=[(f4.x + f4.w + 4, f4.cy), (f4.x + f4.w + 4, p1.cy)])
    pg.arrow(p1.pt('bottom'), p2.pt('top'), label='YES', label_at=(p1.cx + 12, p1.y + p1.h + 14))
    pg.arrow((p1.x + p1.w, p1.cy), p3.pt('right'), route=[(p3.x + p3.w + 5, p1.cy), (p3.x + p3.w + 5, p3.cy)], label='NO', label_at=(p3.x + p3.w + 5, p1.cy - 4))
    pg.connect(p2, p4, 'bottom', 'top')
    # loop back: nurturing -> see
    pg.arrow((p3.x, p3.cy), (s4.x + s4.w, s4.cy + 8), route=[(p3.x - 3, p3.cy), (p3.x - 3, 374), (s4.x + s4.w + 3, 374), (s4.x + s4.w + 3, s4.cy + 8)], color=SAGE, dash=(2, 2))
    pg.text((p3.x + s4.x + s4.w) / 2, 371, 'loop: every response re-enters the daily loop until the lead converts or is closed', 'Sans', 6.2, SAGE, 'center')
    # daily loop ribbon
    pg.hline(28, W - 28, 392, LINE, 0.5)
    pg.text(28, 408, 'THE EMPLOYEE\'S DAILY WORKFLOW', 'Sans-B', 6.4, SAGE)
    steps = ['SEE', 'CONTACT', 'RECORD', 'FOLLOW UP', 'PROGRESS']
    x = 28
    for i, s in enumerate(steps):
        b = Box(x, 416, 96, 22); pg.block(b, s, None, 'auto', size=8)
        if i < 4:
            pg.arrow((b.x + b.w, b.cy), (b.x + b.w + 12, b.cy), GOLD, 1.2)
        x += 108
    pg.para(x + 6, 418, W - 28 - x - 6, 'Nothing about the relationship lives in someone\'s head or phone: every call, message and meeting is recorded once, and the CRM turns it into the next task, the timeline, the status and the numbers on the dashboards. Aaranya example: 7 interactions from the Instagram DM on 5 Sep to the documents received on 17 Sep, 3 status changes, 2 SLA clocks resolved.', 'Sans', 6.8, GREY, leading=9.4)
    pg.mini_legend(28, 468)
    pg.footer(3)


def diagram3(pg: Page):
    pg.header(3, 'Onboarding → Document Verification → Approval', 'From an interested partner to an approved, activation-ready partner — with humans deciding at every gate')
    cols = columns(pg, ['Input', 'CRM process — 10-step onboarding', 'Decision · human reviewer', 'Output', 'Next stage'], bottom=418)
    (x1, w1), (x2, w2), (x3, w3), (x4, w4), (x5, w5) = cols
    bh = 36
    # INPUT
    i1 = Box(x1 + 8, 104, w1 - 16, bh + 4); pg.block(i1, 'Interested partner', 'lead status Interested / Negotiation · partner profile prospective', 'event')
    i2 = Box(x1 + 8, 164, w1 - 16, bh + 10); pg.block(i2, 'Onboarding initiated', 'reviewer assigned · checklist sent · SLA "Onboarding first action" · notification "Onboarding started"', 'human', tag='HUMAN')
    i3 = Box(x1 + 8, 230, w1 - 16, bh + 12); pg.block(i3, 'Onboarding health', 'progress % · steps complete · missing documents · pending reviews · waiting for partner', 'auto')
    i4 = Box(x1 + 8, 298, w1 - 16, bh + 12); pg.block(i4, 'Document expiry watch', 'expiry dates tracked · expired documents flagged automatically · replacement requested', 'auto')
    pg.connect(i1, i2, 'bottom', 'top'); pg.connect(i2, i3, 'bottom', 'top'); pg.connect(i3, i4, 'bottom', 'top')
    # PROCESS: steps grid
    g = Box(x2 + 6, 100, w2 - 12, 176)
    pg.group(g, 'Onboarding wizard · save & resume', fill=white, stroke=SAGE, dash=None)
    steps = ['Basic information', 'About partner', 'Experience', 'Location', 'Pricing', 'Availability', 'Images', 'Documents', 'Policies', 'Final review']
    cw = (g.w - 24) / 2
    for i, s in enumerate(steps):
        col, row = i % 2, i // 2
        b = Box(g.x + 8 + col * (cw + 8), g.y + 20 + row * 30, cw, 24)
        kind = 'human'
        pg.block(b, f'{i + 1}  {s}', None, kind, size=7.4, bold=True)
    pg.text(g.x + g.w / 2, g.y + g.h - 6, 'Initiated → In progress ↔ Waiting for partner', 'Sans', 6, GREY, 'center')
    pr1 = Box(x2 + 8, 292, w2 - 16, 54); pg.block(pr1, 'Documents uploaded & registered', 'registration · GST / certification · insurance · other — type, file, expiry date recorded', 'human', tag='HUMAN')
    pr2 = Box(x2 + 8, 364, w2 - 16, bh + 4); pg.block(pr2, 'Partner submits for verification', 'status Verification · notification to reviewer', 'human', tag='HUMAN')
    pg.arrow(i2.pt('right'), g.pt('left'), route=[(i2.x + i2.w + 4, i2.cy), (i2.x + i2.w + 4, g.cy)])
    pg.connect(g, pr1, 'bottom', 'top'); pg.connect(pr1, pr2, 'bottom', 'top')
    # DECISION
    v1 = Box(x3 + 8, 104, w3 - 16, bh + 16); pg.block(v1, 'Document verification', 'human reviewer checks each file: Pending → Under review → Verified / Rejected (reason: unreadable, wrong type, name mismatch, expired, missing page…)', 'human', tag='HUMAN')
    v2 = Box(x3 + 6, 176, w3 - 12, 62); pg.diamond(v2, 'All verified & complete?')
    v3 = Box(x3 + 8, 256, w3 - 16, bh + 6); pg.block(v3, 'Internal review', 'reviewer / management check of the whole profile', 'human', tag='HUMAN')
    v4 = Box(x3 + 6, 312, w3 - 12, 62); pg.diamond(v4, 'Approved?')
    pg.arrow(pr2.pt('right'), v1.pt('left'), route=[(pr2.x + pr2.w + 4, pr2.cy), (pr2.x + pr2.w + 4, v1.cy)])
    pg.connect(v1, v2, 'bottom', 'top'); pg.arrow(v2.pt('bottom'), v3.pt('top'), label='YES', label_dy=-2); pg.connect(v3, v4, 'bottom', 'top')
    # OUTPUT
    o1 = Box(x4 + 8, 104, w4 - 16, bh + 12); pg.block(o1, 'Changes requested', 'rejected document / missing info · reasons sent · status back to In progress · notification "Document rejected"', 'event')
    o2 = Box(x4 + 8, 172, w4 - 16, bh + 4); pg.block(o2, 'Resubmission → re-review', 'partner replaces the document; reviewer checks again (loop)', 'human', tag='HUMAN')
    o3 = Box(x4 + 8, 250, w4 - 16, bh + 12); pg.block(o3, 'Activation readiness', 'approval · verified documents · price & unit · cancellation policy · availability · capacity · category — reasons listed when not ready', 'auto')
    o4 = Box(x4 + 8, 318, w4 - 16, bh + 8); pg.block(o4, 'Approved / Activated → Live', 'human activation · partner status Active · listings Live · lead status mirrors (Approved → Live / Active)', 'human', tag='HUMAN')
    o5 = Box(x4 + 8, 378, w4 - 16, bh); pg.block(o5, 'Rejected', 'reason recorded · can be re-opened later', 'event')
    pg.arrow((v2.x + v2.w, v2.cy), o1.pt('left'), route=[(o1.x - 6, v2.cy), (o1.x - 6, o1.cy)], label='NO', label_at=(o1.x - 6, v2.cy + 10))
    pg.connect(o1, o2, 'bottom', 'top')
    pg.arrow(o2.pt('left'), v1.pt('right'), route=[(v1.x + v1.w + 8, o2.cy), (v1.x + v1.w + 8, v1.cy)], color=SAGE, dash=(2, 2))
    pg.arrow((v4.x + v4.w, v4.cy), o3.pt('left'), route=[(o3.x - 6, v4.cy), (o3.x - 6, o3.cy)], label='YES', label_at=(o3.x - 6, v4.cy + 10))
    pg.arrow(v4.pt('bottom'), o5.pt('left'), route=[(v4.cx, o5.cy)], label='NO', label_at=(v4.cx + 12, o5.cy - 4))
    pg.connect(o3, o4, 'bottom', 'top')
    # NEXT
    n1 = Box(x5 + 8, 104, w5 - 16, bh + 14); pg.block(n1, 'Partner record live', 'Partner LVP-000001 · Property LVR-000001 · Experience LVE-000001 linked to lead, onboarding, contact & organisation', 'event')
    n2 = Box(x5 + 8, 176, w5 - 16, bh + 12); pg.block(n2, 'Audit trail', 'every status change, document decision, reviewer and reason is recorded permanently', 'auto')
    n3 = Box(x5 + 8, 244, w5 - 16, bh + 12); pg.block(n3, 'Notifications', '"Onboarding completed" · "Approval required" · "Activation ready" · "Document rejected" — in-app + email', 'event')
    n4 = Box(x5 + 8, 318, w5 - 16, bh + 8); pg.block(n4, 'Diagram 5', 'Activation → Experience → Relationship → Growth', 'auto')
    pg.arrow(o4.pt('right'), n1.pt('left'), route=[(o4.x + o4.w + 4, o4.cy), (o4.x + o4.w + 4, n1.cy)])
    pg.connect(n1, n2, 'bottom', 'top'); pg.connect(n2, n3, 'bottom', 'top'); pg.connect(n3, n4, 'bottom', 'top')
    # bottom band: example + statuses
    pg.hline(28, W - 28, 426, LINE, 0.5)
    pg.text(28, 442, 'ONBOARDING STATUS', 'Sans-B', 6.4, SAGE)
    stat = ['Initiated', 'In progress', 'Waiting for partner', 'Verification', 'Internal review', 'Changes requested', 'Approved', 'Rejected', 'Activated']
    x = 28
    for i, s in enumerate(stat):
        w = 74
        b = Box(x, 450, w, 20); pg.block(b, s, None, 'event', size=7, bold=False)
        if i < len(stat) - 1:
            pg.arrow((b.x + b.w, b.cy), (b.x + b.w + 8, b.cy), head=3)
        x += w + 10
    pg.para(28, 478, W - 56, 'Aaranya example (production demo): onboarding In progress, 70 %, step Documents — property registration Verified, GST certificate Verified, insurance certificate Under review, experience information Pending. AI never verifies, approves or rejects a document or a partner: those actions are taken by a named reviewer and written to the audit trail.', 'Sans', 6.8, GREY, leading=9.4)
    pg.mini_legend(28, 506)
    pg.footer(4)


def diagram4(pg: Page):
    pg.header(4, 'CRM Intelligence → Next Best Action', 'How the CRM reads everything known about a lead and turns it into a recommendation a person decides on')
    # layout: input (left) -> intelligence layer (centre, two lanes) -> recommendation -> human decision -> actions -> loop
    x0 = 28
    inp = Box(x0, 100, 128, 232)
    pg.group(inp, 'Input — what the CRM knows', fill=white, stroke=SAGE, dash=None)
    items = [('Lead profile', 'category, location, source, priority, completeness'), ('Interactions', 'channel, outcome, sentiment, commitments, objections'), ('Onboarding & documents', 'progress, verification status, expiry'), ('Tasks & follow-ups', 'due, overdue, completed'), ('SLA clocks & activity', 'on track, breached, last contact')]
    y = inp.y + 18
    for t, s in items:
        b = Box(inp.x + 8, y, inp.w - 16, 36); pg.block(b, t, s, 'event', size=7.4, subsize=6.2)
        y += 42
    # intelligence layer
    lay = Box(176, 100, 330, 232)
    pg.group(lay, 'Intelligence layer — runs automatically whenever the lead changes', fill=PINE_TINT, stroke=PINE, dash=None, label_color=PINE)
    pg.text(lay.x + 8, lay.y + 28, 'AUTOMATED — rule-based, every factor is shown', 'Sans-B', 6.2, PINE)
    auto_items = [('Opportunity score', '0–100 with positive / negative factors'), ('Relationship health', 'healthy · attention · at risk · dormant'), ('Duplicate intelligence', 'similar leads & partners, similarity %'), ('Data quality', 'missing or inconsistent fields'), ('Next best action', 'ranked action with reasons')]
    y = lay.y + 34
    for t, s in auto_items:
        b = Box(lay.x + 8, y, 150, 34); pg.block(b, t, s, 'auto', size=7.4, subsize=6.2)
        y += 38
    pg.text(lay.x + 172, lay.y + 28, 'AI-ASSISTED — suggestions only, always reviewable', 'Sans-B', 6.2, SAGE)
    ai_items = [('Classification', 'category / sub-category with confidence'), ('Conversation summary', 'summary, key points, commitments'), ('Lead summary', 'who, what, pending, risks'), ('Problem intelligence', 'objections → problem suggestions'), ('Communication drafts', 'WhatsApp / meeting follow-up / reminder')]
    y = lay.y + 34
    for t, s in ai_items:
        b = Box(lay.x + 172, y, 150, 34); pg.block(b, t, s, 'ai', size=7.4, subsize=6.2)
        y += 38
    pg.arrow(inp.pt('right'), lay.pt('left'))
    # recommendation
    rec = Box(526, 100, 132, 108)
    pg.block(rec, 'Employee recommendation', 'Lead 360 › Intelligence tab · daily briefing · Copilot answers ("what should I work on today?") · dashboards', 'event', size=8, subsize=6.6)
    pg.arrow(lay.pt('right'), rec.pt('left'))
    dec = Box(526, 224, 132, 108)
    pg.diamond(dec, 'Human decision', 'accept · reject · act')
    pg.connect(rec, dec, 'bottom', 'top')
    # actions
    act = Box(678, 100, 136, 232)
    pg.group(act, 'Action taken by the employee', fill=white, stroke=GOLD, dash=None, label_color=GOLD)
    acts = [('Task / follow-up', 'created or rescheduled'), ('Communication', 'draft edited & sent by the person'), ('Status change', 'governed lifecycle, reason kept'), ('Escalation / problem', 'raised to owner or management'), ('Decision on suggestion', 'accepted or rejected — recorded')]
    y = act.y + 18
    for t, s in acts:
        b = Box(act.x + 8, y, act.w - 16, 36); pg.block(b, t, s, 'human', size=7.4, subsize=6.2, tag=None)
        y += 42
    pg.arrow(dec.pt('right'), act.pt('left'), route=[(668, dec.cy), (668, act.cy)])
    # loop
    loop = Box(28, 352, 786, 40)
    pg.block(loop, 'New interaction / activity  →  CRM intelligence updated  →  next recommendation', 'the loop runs continuously; every human action feeds the next reading of the relationship', 'auto', size=8.4, subsize=6.6)
    pg.arrow(act.pt('bottom'), (act.cx, loop.y), route=[])
    pg.arrow((inp.cx, loop.y), (inp.cx, inp.y + inp.h), color=SAGE, dash=(2, 2))
    pg.text(inp.cx + 4, inp.y + inp.h + 12, 'feeds back', 'Sans', 6, SAGE)
    # boundary
    bnd = Box(28, 402, 786, 22)
    pg.group(bnd, None, fill=SAND, stroke=GOLD, dash=None)
    pg.text(bnd.cx, bnd.y + 14.5, 'Boundary: AI never approves or rejects a partner, verifies a document, changes ownership, deletes records or sets commercial terms — these are human actions, recorded in the audit trail.', 'Sans-B', 6.6, CHAR, 'center')
    # bottom
    pg.hline(28, W - 28, 436, LINE, 0.5)
    pg.text(28, 452, 'WHAT THIS MEANS FOR THE TEAM', 'Sans-B', 6.4, SAGE)
    cols3 = [('Automated', 'Scores, health, duplicates, data quality and next best action are computed from CRM records with transparent factors — no black box. They refresh on every change.'), ('AI-assisted', 'Summaries, classification, problem and draft suggestions are generated on request or after an interaction, labelled as suggestions, and accepted or rejected by a person. If the AI service is unavailable, the CRM keeps working.'), ('Human decision', 'Every consequential action — contact, status, task, escalation, approval — is taken by a named employee and recorded in the audit trail. Aaranya example: score 90, health Attention (overdue follow-up), next best action Follow up.')]
    x = 28
    for t, s in cols3:
        pg.text(x, 468, t, 'Serif-B', 10, PINE)
        pg.para(x, 474, 250, s, 'Sans', 6.8, GREY, leading=9.2)
        x += 268
    pg.mini_legend(28, 522)
    pg.footer(5)


def diagram5(pg: Page):
    pg.header(5, 'Complete La Vivenzia Relationship Lifecycle', 'The master flow: eleven stages, the CRM systems that carry them, and the Experience Graph they build')
    # --- lifecycle ribbon (chevrons)
    stages = [('DISCOVERY', 'Discovered · New'), ('LEAD', 'Assigned'), ('QUALIFICATION', 'Qualifying · Contacted'), ('ENGAGEMENT', 'Engaged'), ('CONVERSION', 'Interested · Negotiation'), ('ONBOARDING', 'Initiated · In progress'), ('VERIFICATION', 'Verification · Internal review'), ('ACTIVATION', 'Approved · Live / Active'), ('EXPERIENCE', 'Properties & experiences live'), ('RELATIONSHIP', 'Interactions · problems · SLAs'), ('GROWTH', 'Growth')]
    x0, y0, hgt, notch = 28, 96, 44, 9
    total = W - 2 * x0
    sw = (total + notch * (len(stages) - 1)) / len(stages)
    c = pg.c
    for i, (s, sub) in enumerate(stages):
        x = x0 + i * (sw - notch)
        p = c.beginPath()
        p.moveTo(x, pg.Y(y0)); p.lineTo(x + sw - notch, pg.Y(y0)); p.lineTo(x + sw, pg.Y(y0 + hgt / 2)); p.lineTo(x + sw - notch, pg.Y(y0 + hgt)); p.lineTo(x, pg.Y(y0 + hgt))
        if i > 0:
            p.lineTo(x + notch, pg.Y(y0 + hgt / 2))
        p.close()
        fill = PINE if i < 5 else (SAGE if i < 8 else GOLD)
        c.setFillColor(fill); c.setStrokeColor(white); c.setLineWidth(1.2)
        c.drawPath(p, stroke=1, fill=1)
        tcol = white if i < 8 else CHAR
        pg.text(x + sw / 2 + 2, y0 + 19, s, 'Sans-B', 6.6, tcol, 'center')
        for j, line in enumerate(simpleSplit(sub, 'Sans', 5.6, sw - 24)):
            pg.text(x + sw / 2 + 2, y0 + 29 + j * 7, line, 'Sans', 5.6, tcol, 'center')
    # diagram references under the ribbon
    refs = [(0, 2, 'Diagram 1 — Capture → Qualification → Assignment'), (2, 5, 'Diagram 2 — Interaction → Follow-up → Conversion'), (5, 8, 'Diagram 3 — Onboarding → Verification → Approval'), (8, 11, 'Diagram 4 — Intelligence → Next best action (runs across every stage)')]
    for a, b, label in refs:
        xa = x0 + a * (sw - notch) + 4; xb = min(x0 + b * (sw - notch) - 4, W - 28)
        pg.hline(xa, xb, y0 + hgt + 8, GOLD, 0.9)
        pg.text((xa + xb) / 2, y0 + hgt + 17, label, 'Sans', 6, SAGE, 'center')
    pg.text(x0, y0 - 6, 'RELATIONSHIP LIFECYCLE  ·  lead status → onboarding status → partner status', 'Sans-B', 6.4, SAGE)
    # --- supporting systems
    sy = 178
    pg.text(x0, sy - 6, 'CRM SYSTEMS THAT CARRY EACH STAGE', 'Sans-B', 6.4, SAGE)
    systems = [('Capture', 'auto'), ('Lead management', 'auto'), ('Assignment', 'auto'), ('Communication', 'human'), ('Tasks', 'auto'), ('Follow-ups', 'auto'), ('Onboarding', 'human'), ('Documents', 'human'), ('Verification', 'human'), ('Experience · Property · Partner', 'event'), ('Intelligence', 'ai'), ('Notifications', 'event'), ('SLA', 'auto'), ('Analytics', 'auto'), ('Control Tower', 'auto')]
    n = len(systems); gap = 6
    bw = (total - gap * (n - 1)) / n
    for i, (s, kind) in enumerate(systems):
        b = Box(x0 + i * (bw + gap), sy, bw, 40)
        pg.block(b, s, None, kind, size=6.2)
        if i < n - 1:
            pg.arrow((b.x + b.w, b.cy), (b.x + b.w + gap, b.cy), SAGE, 0.8, 3)
    caps = ['20 capture methods incl. OCR, links, CSV', 'LV ID · lifecycle · Lead 360 · audit', 'rules + round-robin, accept / decline', 'call · WhatsApp · email · meeting logged; AI drafts', 'native tasks with priority', 'Today · Overdue · Upcoming queues', '10 steps · save & resume · health', 'upload · type · expiry · policy', 'human review, reasons, re-review', 'codes LVP / LVR / LVE · readiness · Live', 'scores · summaries · next best action · Copilot', 'in-app + email · mark read', '4 clocks · breach → escalation', 'KPIs · pipeline · conversion · channels · health', 'team workload · SLA · system health']
    for i, cap in enumerate(caps):
        b = Box(x0 + i * (bw + gap), sy + 44, bw, 30)
        pg.para(b.x + 1, b.y, b.w - 2, cap, 'Sans', 5.4, GREY, leading=6.6, align='center')
    # --- experience graph
    gy = 262
    pg.text(x0, gy - 6, 'THE EXPERIENCE GRAPH — what the CRM builds over time', 'Sans-B', 6.4, SAGE)
    gbox = Box(x0, gy, total, 138)
    pg.group(gbox, None, fill=SAND, stroke=SAND_DARK, dash=None)
    nodes = [('People', 'contacts, hosts, managers', 'event'), ('Organisations', 'the partner\'s business', 'event'), ('Properties', 'stays · LVR codes', 'event'), ('Experiences', 'guided experiences · LVE codes', 'event'), ('Interactions', 'every conversation, outcome, sentiment', 'event'), ('Relationships', 'lead → partner → listings · owner · reviewer', 'event'), ('Behaviour / Demand', 'guest behaviour and demand signals', 'future')]
    nn = len(nodes); ngap = 22
    nw = (total - 40 - ngap * (nn - 1)) / nn
    for i, (t, s, kind) in enumerate(nodes):
        b = Box(gbox.x + 20 + i * (nw + ngap), gy + 24, nw, 48)
        pg.block(b, t, s, kind, size=8, subsize=6.2, tag='PLANNED / FUTURE' if kind == 'future' else None)
        if i < nn - 1:
            # two-way link
            pg.arrow((b.x + b.w, b.cy - 5), (b.x + b.w + ngap, b.cy - 5), PINE, 0.9, 3.2)
            pg.arrow((b.x + b.w + ngap, b.cy + 5), (b.x + b.w, b.cy + 5), PINE, 0.9, 3.2)
    pg.para(gbox.x + 20, gy + 84, total - 40, 'Today the graph is built from linked CRM records: a partner links its lead, onboarding, contact person and organisation; every property has a manager and every experience a host; every interaction, task, document and decision hangs off the lead. Aaranya: 1 organisation · 3 people · 1 lead · 7 interactions · 1 onboarding with 4 documents · 1 partner · 1 property · 1 experience — all navigable from one another.', 'Sans', 6.8, CHAR, leading=9.2)
    pg.para(gbox.x + 20, gy + 118, total - 40, 'Behaviour / Demand (guest behaviour, bookings, revenue, feedback) needs booking and guest data the CRM does not hold in V1 — it is the planned next layer, fed by the CRM, not built inside it.', 'Sans-I' if False else 'Sans', 6.6, GREY, leading=8.8)
    # bottom band
    pg.hline(28, W - 28, 416, LINE, 0.5)
    pg.text(28, 432, 'HOW TO READ THE MASTER FLOW', 'Sans-B', 6.4, SAGE)
    texts = [('Stages 1–5  ·  Lead', 'Captured once, assigned by rules, worked through the daily loop until the partner is interested. Status is governed: only allowed moves, reasons on negative outcomes.'), ('Stages 6–8  ·  Partner', 'A ten-step onboarding with human document verification and a human approval gate. Activation readiness is checked automatically; activation is a human act.'), ('Stages 9–11  ·  Relationship', 'Live properties and experiences, continuing interactions, problems and SLAs; the relationship keeps feeding intelligence, analytics and the Control Tower. Growth analytics on bookings: PLANNED / FUTURE.')]
    x = 28
    for t, s in texts:
        pg.text(x, 448, t, 'Serif-B', 10, PINE)
        pg.para(x, 454, 250, s, 'Sans', 6.8, GREY, leading=9.2)
        x += 268
    pg.mini_legend(28, 500)
    pg.footer(6)


def legend(pg: Page):
    pg.header('LEGEND', 'How to read these diagrams', 'Block colours, arrows and tags used on every page')
    pg.c.setFillColor(white)
    rows = [
        ('auto', 'Automated', 'The CRM does this by itself, from rules and records — no AI involved. Examples: unique LV Lead ID, assignment engine, duplicate matching, opportunity score, SLA clocks, follow-up task creation, activation readiness, onboarding health, document expiry watch, audit trail.'),
        ('ai', 'AI-assisted', 'A suggestion generated from CRM records, labelled as a suggestion, and accepted or rejected by a person. Examples: OCR / data extraction, category classification, conversation & lead summaries, problem suggestions, communication drafts, Copilot answers. If the AI service is unavailable the CRM continues without it.'),
        ('human', 'Human action', 'A named employee, reviewer or manager does this and the CRM records who, when and why. Examples: field review and confirm, duplicate decision, accept assignment, call / message / meet, log interaction, status change, document verification, internal review, approval, activation.'),
        ('event', 'System event / record', 'Something that now exists or happened in the CRM: a lead, a partner, a notification, an audit event, a timeline entry, a status.'),
        ('future', 'Planned / future', 'Described in the La Vivenzia requirements but not built in this version. Shown dashed so nothing in the deck over-claims.'),
    ]
    y = 96
    for kind, title, desc in rows:
        b = Box(40, y, 150, 30); pg.block(b, title, None, kind, size=8.6)
        pg.para(210, y + 2, W - 250, desc, 'Sans', 7.6, CHAR, leading=10.4)
        y += 48
    # decision + arrows
    d = Box(40, y, 150, 46); pg.diamond(d, 'Decision', 'YES / NO')
    pg.para(210, y + 8, W - 250, 'A question answered by a person (or, for duplicates and readiness, by a rule whose factors are shown). Arrows are labelled YES / NO where the path splits.', 'Sans', 7.6, CHAR, leading=10.4)
    y += 62
    pg.arrow((40, y + 10), (120, y + 10)); pg.text(210, y + 13, 'Process sequence — what happens next.', 'Sans', 7.6, CHAR)
    pg.arrow((40, y + 28), (120, y + 28), SAGE, dash=(2, 2)); pg.text(210, y + 31, 'Loop / return — the flow re-enters an earlier step (re-review, daily loop, intelligence refresh).', 'Sans', 7.6, CHAR)
    pg.chip(40, y + 42, 'HUMAN'); pg.chip(80, y + 42, 'AI'); pg.chip(105, y + 42, 'PLANNED / FUTURE')
    pg.text(210, y + 50, 'Tags on a block repeat its nature so the diagrams also read in black and white.', 'Sans', 7.6, CHAR)
    y += 72
    pg.hline(40, W - 40, y, GOLD, 0.9)
    pg.text(40, y + 16, 'Coverage note', 'Serif-B', 11, PINE)
    pg.para(40, y + 24, W - 80, 'Everything drawn as Automated, AI-assisted, Human action or System event is implemented and running in the La Vivenzia CRM (production, September 2026), and was exercised with the Aaranya Trails & Stays demonstration data. Marked PLANNED / FUTURE: sending WhatsApp / Instagram messages from inside the CRM (drafts are produced, sending is manual), the Behaviour / Demand layer of the Experience Graph, and growth analytics on bookings and revenue. Not drawn because not built: voice capture, AI reading of uploaded documents, funnel drill-down charts and category administration by non-developers.', 'Sans', 7.4, CHAR, leading=10.2)
    pg.footer(7)


def build():
    c = canvas.Canvas(OUT, pagesize=landscape(A4))
    c.setTitle('La Vivenzia CRM — End-to-End Business Flows')
    c.setAuthor('La Vivenzia')
    c.setSubject('How the CRM captures, manages, onboards and grows relationships')
    pg = Page(c)
    for fn in (cover, diagram1, diagram2, diagram3, diagram4, diagram5, legend):
        fn(pg)
        c.showPage()
    c.save()
    print('wrote', os.path.abspath(OUT))


if __name__ == '__main__':
    build()
