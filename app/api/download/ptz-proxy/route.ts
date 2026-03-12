import { NextRequest, NextResponse } from "next/server";
import { existsSync, statSync, readFileSync, readdirSync } from "fs";
import { join } from "path";

// ─────────────────────────────────────────────────────────────
// force-dynamic: request.url(searchParams)를 사용하는 라우트는
// 반드시 동적 렌더링으로 지정해야 함.
// 없으면 Next.js 빌드 시 static rendering을 시도하다 에러 발생:
//   "Dynamic server usage: couldn't be rendered statically"
// ─────────────────────────────────────────────────────────────
export const dynamic = "force-dynamic";

// PTZ Proxy 파일 다운로드
// - ?type=list : 업로드된 파일 목록 반환 (JSON)
// - ?file=xxx  : public/downloads/xxx 파일 직접 다운로드
// - (기본)      : 파일 미준비 안내 (404)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = request.nextUrl;
        const fileParam = searchParams.get("file");
        const typeParam = searchParams.get("type");

        const downloadsDir = join(process.cwd(), "public", "downloads");

        // ?file=filename → 특정 파일 직접 다운로드
        if (fileParam) {
            const safeName = fileParam.replace(/[^a-zA-Z0-9._\-]/g, "_");
            const filePath = join(downloadsDir, safeName);
            if (!existsSync(filePath)) {
                return NextResponse.json(
                    { error: "File not found" },
                    { status: 404 },
                );
            }
            const buffer = readFileSync(filePath);
            const isExe =
                safeName.endsWith(".exe") || safeName.endsWith(".msi");
            return new NextResponse(buffer, {
                headers: {
                    "Content-Type": isExe
                        ? "application/octet-stream"
                        : "application/zip",
                    "Content-Disposition": `attachment; filename="${safeName}"`,
                    "Content-Length": buffer.length.toString(),
                },
            });
        }

        // ?type=list → 업로드된 파일 목록만 반환
        if (typeParam === "list") {
            const files = existsSync(downloadsDir)
                ? readdirSync(downloadsDir).map((name: string) => {
                      const stat = statSync(join(downloadsDir, name));
                      return {
                          filename: name,
                          size: stat.size,
                          downloadUrl: `/downloads/${name}`,
                      };
                  })
                : [];
            return NextResponse.json({ files });
        }

        // 기본: 소스 코드 ZIP은 더 이상 제공하지 않음
        return NextResponse.json(
            { error: "다운로드 파일이 준비되지 않았습니다. 관리자에게 문의하세요." },
            { status: 404 },
        );
    } catch (error) {
        console.error("Download error:", error);
        return NextResponse.json(
            { error: "Failed to create download" },
            { status: 500 },
        );
    }
}
