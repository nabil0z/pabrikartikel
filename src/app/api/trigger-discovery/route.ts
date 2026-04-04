import { processAutoDiscovery } from "@/worker/discovery";
import { NextResponse } from "next/server";

// Endpoint Rahasia untuk memancing Auto-Discovery bekerja (Serper News + Gemini AI)
// Jalankan melalui browser dengan membuka http://IP_VPS:7171/api/trigger-discovery
export const dynamic = "force-dynamic"; // Bypass Cache

export async function GET() {
  try {
    // Jalankan tanpa harus di-await agar browser tidak timeout 
    // (Serper+Gemini kadang lambat membalas)
    processAutoDiscovery(true).catch(e => console.error("Manual Discovery Error:", e));
    
    return NextResponse.json({
      status: "Berhasil dipancing!",
      pesan: "Mesin Pabrik sedang menyelam ke Serper News + Gemini AI. Cek dashboard antrean artikel Anda beberapa menit lagi."
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
