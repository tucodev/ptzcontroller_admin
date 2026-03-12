"""Convert 00-quick-start.md to PDF with Korean font support."""

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, Preformatted, KeepTogether
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Register Korean fonts
FONT_PATH = "C:/Windows/Fonts/malgun.ttf"
FONT_BOLD_PATH = "C:/Windows/Fonts/malgunbd.ttf"
pdfmetrics.registerFont(TTFont("Malgun", FONT_PATH))
pdfmetrics.registerFont(TTFont("MalgunBold", FONT_BOLD_PATH))

# Output path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_PDF = os.path.join(SCRIPT_DIR, "00-quick-start.pdf")

# Colors
BLUE = HexColor("#1a56db")
DARK = HexColor("#1f2937")
GRAY = HexColor("#6b7280")
LIGHT_BG = HexColor("#f3f4f6")
WHITE = HexColor("#ffffff")
BORDER = HexColor("#d1d5db")
ACCENT = HexColor("#2563eb")

# Styles
styles = getSampleStyleSheet()

s_title = ParagraphStyle("KTitle", fontName="MalgunBold", fontSize=20, leading=28,
                          textColor=DARK, alignment=TA_CENTER, spaceAfter=4)
s_subtitle = ParagraphStyle("KSubtitle", fontName="Malgun", fontSize=10, leading=14,
                             textColor=GRAY, alignment=TA_CENTER, spaceAfter=2)
s_desc = ParagraphStyle("KDesc", fontName="Malgun", fontSize=10, leading=15,
                         textColor=GRAY, alignment=TA_CENTER, spaceAfter=6)
s_h2 = ParagraphStyle("KH2", fontName="MalgunBold", fontSize=14, leading=20,
                        textColor=BLUE, spaceBefore=14, spaceAfter=6)
s_h3 = ParagraphStyle("KH3", fontName="MalgunBold", fontSize=11, leading=16,
                        textColor=DARK, spaceBefore=8, spaceAfter=4)
s_body = ParagraphStyle("KBody", fontName="Malgun", fontSize=9.5, leading=15,
                          textColor=DARK, spaceAfter=3)
s_bullet = ParagraphStyle("KBullet", fontName="Malgun", fontSize=9.5, leading=15,
                            textColor=DARK, leftIndent=14, spaceAfter=2)
s_note = ParagraphStyle("KNote", fontName="Malgun", fontSize=8.5, leading=13,
                          textColor=GRAY, leftIndent=14, spaceAfter=3, fontStyle="italic")
s_code = ParagraphStyle("KCode", fontName="Malgun", fontSize=8.5, leading=13,
                          textColor=DARK, backColor=LIGHT_BG, leftIndent=10,
                          rightIndent=10, spaceBefore=4, spaceAfter=4,
                          borderWidth=0.5, borderColor=BORDER, borderPadding=6)
s_footer = ParagraphStyle("KFooter", fontName="Malgun", fontSize=8, leading=12,
                            textColor=GRAY, alignment=TA_CENTER, spaceBefore=10)

# Table header/cell styles
s_th = ParagraphStyle("TH", fontName="MalgunBold", fontSize=8.5, leading=12, textColor=WHITE)
s_td = ParagraphStyle("TD", fontName="Malgun", fontSize=8.5, leading=12, textColor=DARK)


def make_table(headers, rows, col_widths=None):
    """Create a styled table."""
    data = [[Paragraph(h, s_th) for h in headers]]
    for row in rows:
        data.append([Paragraph(c, s_td) for c in row])

    if col_widths is None:
        col_widths = [170 * mm / len(headers)] * len(headers)

    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("FONTNAME", (0, 0), (-1, 0), "MalgunBold"),
        ("FONTNAME", (0, 1), (-1, -1), "Malgun"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, LIGHT_BG]),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


def hr():
    return HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceBefore=6, spaceAfter=6)


def build_pdf():
    doc = SimpleDocTemplate(
        OUTPUT_PDF, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=18 * mm, bottomMargin=18 * mm,
        title="PTZ Controller - Quick Start Guide",
        author="TYCHE Inc"
    )

    story = []

    # Title block
    story.append(Spacer(1, 8))
    story.append(Paragraph("PTZ Controller", s_title))
    story.append(Paragraph("Quick Start Guide", ParagraphStyle("Sub2", parent=s_subtitle, fontSize=13, leading=18, textColor=ACCENT)))
    story.append(Spacer(1, 4))
    story.append(Paragraph("제작 : TYCHE Inc (주식회사 타이키)", s_subtitle))
    story.append(Spacer(1, 6))
    story.append(Paragraph("PTZ을 웹 브라우져를 통해 제어하는 프로그램 입니다.", s_desc))
    story.append(Paragraph("인터넷이 된다면 어디서든 PTZ을 제어할 수 있습니다.", s_desc))
    story.append(Paragraph("처음 접속하는 사용자를 위한 빠른 시작 가이드입니다.", s_desc))
    story.append(hr())

    # Section 1
    story.append(Paragraph("1. 회원가입 (필수)", s_h2))
    story.append(Paragraph('1. 브라우저에서 PTZ Controller 주소에 접속합니다. ( <font color="#2563eb">https://ptz.tycheai.xyz</font> )', s_body))
    story.append(Paragraph('2. 로그인 화면 하단의 <b>"Don\'t have an account? Sign up"</b> 을 클릭합니다.', s_body))
    story.append(Paragraph("3. 이름, 회사/소속, 이메일, 비밀번호(8자 이상)를 입력합니다.", s_body))
    story.append(Paragraph('4. <b>"Create Account"</b> 를 클릭하면 가입이 완료되고 자동으로 로그인됩니다.', s_body))
    story.append(hr())

    # Section 2
    story.append(Paragraph("2. 카메라 추가", s_h2))
    story.append(Paragraph('1. 대시보드 왼쪽 <b>Cameras</b> 영역의 <b>+</b> 버튼을 클릭합니다.', s_body))
    story.append(Paragraph("2. 다음 항목을 입력합니다.", s_body))
    story.append(Spacer(1, 4))

    cam_table = make_table(
        ["항목", "설명", "예시"],
        [
            ["Camera Name", "카메라 이름", "1번 카메라"],
            ["Protocol", "통신 프로토콜", "PelcoD / Ujin / ONVIF"],
            ["PTZ 카메라 IP", "카메라 IP (Proxy 기준)", "192.168.1.100"],
            ["Port", "통신 포트", "4001"],
            ["Device Address", "장치 주소 (PelcoD/Ujin)", "1"],
            ["Proxy URL", "PTZ Proxy 주소", "ws://localhost:9902 (유지)"],
        ],
        col_widths=[40 * mm, 50 * mm, 80 * mm]
    )
    story.append(cam_table)
    story.append(Spacer(1, 4))
    story.append(Paragraph("(주의) Proxy URL의 경우 기본 환경 사용시에는 변경하지 마십시요. 변경이 필요할 시 전문가의 도움을 받으십시요.", s_note))
    story.append(Paragraph('3. <b>Save</b> 를 클릭합니다.', s_body))
    story.append(Paragraph("ONVIF 카메라: Profile Token은 비워두면 자동으로 조회됩니다. 또는 카메라 메뉴얼을 통해 설정.", s_note))
    story.append(hr())

    # Section 3
    story.append(Paragraph("3. PTZ Proxy 준비", s_h2))
    story.append(Paragraph("PTZ Controller는 카메라에 직접 접근을 위하여 <b>PTZ Proxy</b>가 필요합니다.", s_body))
    story.append(Spacer(1, 2))
    story.append(Paragraph("브라우저  &lt;-&gt;  PTZ Proxy  &lt;-&gt;  PTZ 카메라 (TCP-지원중, 시리얼-추후 지원 예정)", s_code))
    story.append(Spacer(1, 2))
    story.append(Paragraph("- PTZ Proxy를 카메라에 접근 가능한 PC에서 실행합니다.", s_bullet))
    story.append(Paragraph("- 기본 포트: <b>9902</b>", s_bullet))
    story.append(Paragraph("PTZ Proxy를 실행하지 않은 상태에서 연결을 시도하면 다운로드 안내 팝업이 자동으로 나타납니다. Cloud Download나 직접 실행파일 다운로드 버튼을 통해 설치 파일을 다운로드 하고 설치한 후 실행하세요.", s_note))
    story.append(hr())

    # Section 4
    story.append(Paragraph("4. 카메라 연결 및 제어", s_h2))
    story.append(Paragraph("1. 카메라 목록에서 카메라를 클릭하여 선택합니다.", s_body))
    story.append(Paragraph('2. <b>Connect</b> 버튼을 클릭합니다.', s_body))
    story.append(Paragraph('3. 연결 상태가 <b>connected</b> 로 바뀌면 제어할 수 있습니다.', s_body))
    story.append(Spacer(1, 2))

    story.append(Paragraph("기본 제어", s_h3))
    ctrl_table = make_table(
        ["제어", "조작"],
        [
            ["Pan / Tilt", "방향 버튼을 누르고 있는 동안 이동, 떼면 정지"],
            ["Zoom", "In / Out 버튼"],
            ["Focus", "Near / Far 버튼"],
            ["속도 조절", "각 슬라이더 (1\u2013100%)"],
            ["프리셋", "1\u20136 빠른 버튼 또는 숫자 입력 후 Go / Set"],
        ],
        col_widths=[40 * mm, 130 * mm]
    )
    story.append(ctrl_table)
    story.append(hr())

    # Section 5
    story.append(Paragraph("5. Hex 모니터", s_h2))
    story.append(Paragraph("화면 하단의 <b>Hex Monitor</b> 에서 카메라와 주고받는 패킷을 실시간으로 확인할 수 있습니다.", s_body))
    story.append(Paragraph('- <font color="#16a34a"><b>TX</b></font> (초록): 전송한 명령', s_bullet))
    story.append(Paragraph('- <font color="#2563eb"><b>RX</b></font> (파랑): 카메라 응답', s_bullet))
    story.append(Paragraph("- 상단 바에 Pause / Export / Clear 버튼 제공", s_bullet))
    story.append(Paragraph("ONVIF는 HTTP 통신이므로 TX가 표시되지 않는 것은 정상입니다.", s_note))
    story.append(hr())

    # Section 6
    story.append(Paragraph("6. 설정", s_h2))
    story.append(Paragraph("헤더의 설정(톱니바퀴) 아이콘을 클릭하면 기본 설정을 변경할 수 있습니다.", s_body))
    story.append(Spacer(1, 4))
    settings_table = make_table(
        ["설정", "설명"],
        [
            ["Default Protocol", "새 카메라 추가 시 기본 프로토콜"],
            ["Proxy WebSocket Port", "기본 Proxy 포트"],
            ["Theme", "Light / Dark / System (기본: System)"],
        ],
        col_widths=[55 * mm, 115 * mm]
    )
    story.append(settings_table)
    story.append(hr())

    # Section 7
    story.append(Paragraph("7. 비밀번호를 잊었을 때", s_h2))
    story.append(Paragraph('1. 로그인 화면에서 <b>"비밀번호를 잊으셨나요?"</b> 를 클릭합니다.', s_body))
    story.append(Paragraph("2. 가입한 이메일을 입력하면 재설정 링크가 발송됩니다.", s_body))
    story.append(Paragraph("3. 이메일의 링크를 클릭하여 새 비밀번호를 설정합니다.", s_body))
    story.append(hr())

    # Summary
    story.append(Paragraph("요약 — 처음 사용 순서", s_h2))
    story.append(Spacer(1, 2))
    flow_text = "①  회원가입    →    ②  카메라 추가    →    ③  PTZ Proxy 실행    →    ④  Connect    →    ⑤  PTZ 제어"
    story.append(Paragraph(flow_text, ParagraphStyle("Flow", parent=s_code, fontSize=10, leading=16, alignment=TA_CENTER)))
    story.append(Spacer(1, 12))

    # Footer
    story.append(hr())
    story.append(Paragraph('본 프로그램의 모든 권리는 (주) 타이키에 있습니다.  <font color="#2563eb">https://www.tyche.pro</font>', s_footer))

    doc.build(story)
    print(f"PDF created: {OUTPUT_PDF}")


if __name__ == "__main__":
    build_pdf()
