import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand
} from '@aws-sdk/client-s3'
import { v4 as uuidv4 } from 'uuid'
import config from 'config'
import { apiLogger as logger } from 'lib/logger'

const s3Client = new S3Client({
  credentials: {
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
    sessionToken: config.AWS_SESSION_TOKEN
  },
  region: config.AWS_REGION
})

/**
 * Upload data to s3
 * @async
 * @function
 * @param {string} body Object data.
 * @returns {string}
 */
export async function uploadFile(body: string): Promise<string> {
  try {
    const createCommand = new CreateMultipartUploadCommand({
      Bucket: config.AWS_S3_BUCKET,
      ACL: 'public-read',
      ContentType: 'text/csv',
      Key: `csv/transaction-history-${uuidv4()}.csv`
    })

    const { UploadId, Key } = await s3Client.send(createCommand)

    const uploadCommand = new UploadPartCommand({
      Bucket: config.AWS_S3_BUCKET,
      Body: body,
      PartNumber: 1,
      Key,
      UploadId
    })

    await s3Client.send(uploadCommand)

    const completeCommand = new CompleteMultipartUploadCommand({
      Bucket: config.AWS_S3_BUCKET,
      UploadId,
      Key
    })

    const { Location } = await s3Client.send(completeCommand)

    return Location || ''
  } catch (err) {
    logger.error('Error uploading file: ', err)

    throw err
  }
}
