import { describe, expect, it } from 'vitest'
import { getTestInstance } from 'better-auth/test'

type UserVerificationUpdater = {
  update(args: {
    model: 'user'
    where: Array<{ field: 'email'; value: string }>
    update: { emailVerified: boolean }
  }): Promise<unknown>
}

describe('Better Auth password reset flow', () => {
  it('accepts the new password after reset and rejects token reuse', async () => {
    const capturedTokens: string[] = []
    const newPassword = 'new-password-1234'

    const instance = await getTestInstance({
      emailAndPassword: {
        enabled: true,
        sendResetPassword: async ({ token }) => {
          capturedTokens.push(token)
        },
      },
    })

    const userVerificationUpdater =
      instance.db as unknown as UserVerificationUpdater

    await userVerificationUpdater.update({
      model: 'user',
      where: [{ field: 'email', value: instance.testUser.email }],
      update: { emailVerified: true },
    })

    await instance.auth.api.requestPasswordReset({
      body: {
        email: instance.testUser.email,
        redirectTo: 'http://localhost:3000/reset-password',
      },
      headers: new Headers({
        origin: 'http://localhost:3000',
      }),
    })

    expect(capturedTokens).toHaveLength(1)

    await instance.auth.api.resetPassword({
      body: {
        token: capturedTokens[0],
        newPassword,
      },
      headers: new Headers(),
    })

    const oldPasswordResult = await instance.client.signIn.email({
      email: instance.testUser.email,
      password: instance.testUser.password,
    })
    expect(oldPasswordResult.error?.code).toBe('INVALID_EMAIL_OR_PASSWORD')

    const newPasswordResult = await instance.client.signIn.email({
      email: instance.testUser.email,
      password: newPassword,
    })
    expect(newPasswordResult.error).toBeNull()
    expect(newPasswordResult.data?.user.email).toBe(instance.testUser.email)

    await expect(
      instance.auth.api.resetPassword({
        body: {
          token: capturedTokens[0],
          newPassword: 'another-password-1234',
        },
        headers: new Headers(),
      }),
    ).rejects.toMatchObject({
      body: expect.objectContaining({
        code: 'INVALID_TOKEN',
      }),
    })
  })
})
