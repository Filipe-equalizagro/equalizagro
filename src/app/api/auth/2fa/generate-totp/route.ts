import { NextRequest, NextResponse } from 'next/server';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    // Generate TOTP secret
    const secret = speakeasy.generateSecret({
      name: `Equalizagro (${email})`,
      issuer: 'Equalizagro',
      length: 32,
    });

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

    // Generate backup codes (10 codes)
    const backupCodes = Array.from({ length: 10 }).map(() =>
      speakeasy.generateSecret({ length: 8 }).base32
    );

    return NextResponse.json(
      {
        success: true,
        secret: secret.base32,
        qrCode,
        backupCodes,
        manualEntryKey: secret.base32,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error generating TOTP:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate TOTP secret' },
      { status: 500 }
    );
  }
}
