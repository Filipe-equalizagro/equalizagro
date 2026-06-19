import { NextRequest, NextResponse } from 'next/server';
import speakeasy from 'speakeasy';

export async function POST(request: NextRequest) {
  try {
    const { secret, token } = await request.json();

    if (!secret || !token) {
      return NextResponse.json(
        { success: false, error: 'Secret and token are required' },
        { status: 400 }
      );
    }

    // Verify the token
    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 2, // Allow 2 time windows (±30 seconds)
    });

    if (!verified) {
      return NextResponse.json(
        { success: false, error: 'Invalid TOTP code' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'TOTP code verified successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error verifying TOTP:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to verify TOTP code' },
      { status: 500 }
    );
  }
}
