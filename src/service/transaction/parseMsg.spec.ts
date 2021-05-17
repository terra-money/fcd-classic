import { convertToFailureMessage } from './parseMsg'

test('parseMsg', () => {
  expect(convertToFailureMessage('Received 9,980.039920 Luna from terra1asdfasdf')).toStrictEqual(
    'receive 9,980.039920 Luna from terra1asdfasdf'
  )
})
