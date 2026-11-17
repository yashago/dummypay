import { loginSchema, registerSchema } from '@/features/auth/schemas'
import { authErrorMessage } from '@/lib/errors'

const valid = {
  displayName: '  Dana  ',
  email: ' Dana@Example.COM ',
  password: 'secret-123',
  confirmPassword: 'secret-123',
  preferredCurrency: 'ILS',
}

describe('registerSchema', () => {
  it('accepts and normalises valid input', () => {
    const parsed = registerSchema.parse(valid)
    expect(parsed.displayName).toBe('Dana')
    expect(parsed.email).toBe('dana@example.com')
  })

  it.each([
    [{ email: 'not-an-email' }, 'email'],
    [{ displayName: 'A' }, 'displayName'],
    [{ displayName: 'x'.repeat(51) }, 'displayName'],
    [{ password: 'short', confirmPassword: 'short' }, 'password'],
    [{ confirmPassword: 'different' }, 'confirmPassword'],
    [{ preferredCurrency: 'JPY' }, 'preferredCurrency'],
  ])('rejects %j', (override, path) => {
    const result = registerSchema.safeParse({ ...valid, ...override })
    expect(result.success).toBe(false)
    expect(result.error!.issues.map((i) => i.path[0])).toContain(path)
  })
})

describe('loginSchema', () => {
  it('requires a valid email and a password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true)
    expect(loginSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false)
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false)
  })
})

describe('authErrorMessage', () => {
  it('maps known Auth codes to friendly text', () => {
    expect(authErrorMessage({ code: 'invalid_credentials' })).toBe('Incorrect email or password.')
    expect(authErrorMessage({ code: 'user_already_exists' })).toMatch(/already exists/)
    expect(authErrorMessage({ status: 429 })).toMatch(/Too many attempts/)
  })

  it('never leaks raw database errors', () => {
    const msg = authErrorMessage({ message: 'Database error saving new user: INVALID_CURRENCY' })
    expect(msg).not.toMatch(/database|INVALID/i)
  })
})
