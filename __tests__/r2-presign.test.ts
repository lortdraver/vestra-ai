import { describe, expect, it } from 'vitest'
import { presignGetUrl } from '@/lib/storage/r2'

describe('presignGetUrl', () => {
  it('matches the AWS Signature V4 presigned GET example', () => {
    // Example from the AWS S3 docs ("Authenticating Requests: Using Query
    // Parameters"), which publishes the expected signature.
    const url = presignGetUrl({
      origin: 'https://examplebucket.s3.amazonaws.com',
      host: 'examplebucket.s3.amazonaws.com',
      path: '/test.txt',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      region: 'us-east-1',
      signedAt: new Date('2013-05-24T00:00:00Z'),
      expiresSeconds: 86400,
    })
    expect(url).toContain(
      'X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
    )
  })
})
