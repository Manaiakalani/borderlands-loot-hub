/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CodeCard } from '../components/CodeCard';
import type { ShiftCode } from '../data/shiftCodes';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

function makeCode(overrides: Partial<ShiftCode> = {}): ShiftCode {
  return {
    id: 'test-card-1',
    code: 'AAAAA-BBBBB-CCCCC-DDDDD-EEEEE',
    game: 'BL3',
    status: 'active',
    reward: '3 Golden Keys',
    rewardType: 'golden-keys',
    source: 'test-source',
    addedAt: '2026-07-01',
    ...overrides,
  };
}

describe('CodeCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renders code, reward, and source info', () => {
    render(<CodeCard code={makeCode()} />);
    expect(screen.getByText('AAAAA-BBBBB-CCCCC-DDDDD-EEEEE')).toBeTruthy();
    expect(screen.getByText('3 Golden Keys')).toBeTruthy();
    expect(screen.getByText(/test-source/)).toBeTruthy();
  });

  it('renders the game badge', () => {
    render(<CodeCard code={makeCode({ game: 'BL4' })} />);
    expect(screen.getByText('BL4')).toBeTruthy();
  });

  it('shows active status for active codes', () => {
    render(<CodeCard code={makeCode({ status: 'active' })} />);
    expect(screen.getByText('Active')).toBeTruthy();
  });

  it('shows expired status and disables copy for expired codes', () => {
    render(<CodeCard code={makeCode({ status: 'expired' })} />);
    expect(screen.getByText('Expired')).toBeTruthy();
    const copyBtn = screen.getByRole('button', { name: /copy/i });
    expect(copyBtn).toHaveAttribute('disabled');
  });

  it('copies code to clipboard on copy button click', async () => {
    render(<CodeCard code={makeCode()} />);
    const copyBtn = screen.getByRole('button', { name: /copy/i });
    fireEvent.click(copyBtn);
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('AAAAA-BBBBB-CCCCC-DDDDD-EEEEE');
    });
  });

  it('shows NEW badge when isNew prop is true', () => {
    render(<CodeCard code={makeCode()} isNew={true} />);
    expect(screen.getByText('NEW')).toBeTruthy();
  });

  it('shows RECENT badge when isRecent prop is true', () => {
    render(<CodeCard code={makeCode()} isRecent={true} />);
    expect(screen.getByText('RECENT')).toBeTruthy();
  });

  it('shows redeem link for active codes', () => {
    render(<CodeCard code={makeCode()} />);
    const redeemLink = screen.getByRole('link', { name: /redeem/i });
    expect(redeemLink).toHaveAttribute('href', 'https://shift.gearboxsoftware.com/rewards');
    expect(redeemLink).toHaveAttribute('target', '_blank');
  });

  it('does not show redeem link for expired codes', () => {
    render(<CodeCard code={makeCode({ status: 'expired' })} />);
    expect(screen.queryByRole('link', { name: /redeem/i })).toBeNull();
  });

  it('shows expiration info when expiresAt is set', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const code = makeCode({ expiresAt: futureDate.toISOString().split('T')[0] });
    render(<CodeCard code={code} />);
    expect(screen.getByText(/Expires/)).toBeTruthy();
  });

  it('shows "No expiration" for active codes without expiresAt', () => {
    render(<CodeCard code={makeCode({ expiresAt: undefined })} />);
    expect(screen.getByText(/No expiration/)).toBeTruthy();
  });

  it('has accessible aria-label on copy button', () => {
    render(<CodeCard code={makeCode()} />);
    const copyBtn = screen.getByRole('button', { name: /copy code/i });
    expect(copyBtn).toBeTruthy();
  });

  it('does not throw when clipboard API is unavailable', async () => {
    // Simulate restricted context where clipboard is undefined
    Object.defineProperty(navigator, 'clipboard', { value: undefined, writable: true, configurable: true });

    render(<CodeCard code={makeCode()} />);
    const copyBtn = screen.getByRole('button', { name: /copy/i });

    // Should not throw
    fireEvent.click(copyBtn);
    const { toast } = await import('sonner');
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Clipboard not available — copy the code manually');
    });
  });
});
