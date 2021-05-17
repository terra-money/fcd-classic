import { convertToFailureMessage } from './helper'

test('convertToFailureMessage', () => {
  const fixtures = [
    ['Sent 9,980.039920 Luna from terra1asdfasdf', 'send 9,980.039920 Luna from terra1asdfasdf'],
    ['Received 9,980.039920 Luna from terra1asdfasdf', 'receive 9,980.039920 Luna from terra1asdfasdf'],
    ['Requested unjail for terra1...', 'request unjail for terra1...'],
    ['Set withdraw address as terra1...', 'set withdraw address as terra1...'],
    ['Withdraw reward from validator1', 'withdraw reward from validator1'],
    ["Withdraw validator1's commission", "withdraw validator1's commission"],
    ['Created validator terravaloper1...', 'create validator terravaloper1...'],
    ['Edited validator terravaloper1...', 'edit validator terravaloper1...'],
    ['Delegated 1234.567890 Luna to terravaloper1...', 'delegate 1234.567890 Luna to terravaloper1...'],
    ['Redelegated 1234.567890 Luna to terravaloper1...', 'redelegate 1234.567890 Luna to terravaloper1...'],
    [
      'Requested to undelegate 1234.567890 Luna from validator1',
      'request to undelegate 1234.567890 Luna from validator1'
    ],
    ['Prevoted price of LUNA denominated in UST', 'prevote price of LUNA denominated in UST'],
    ['Voted oracle price of LUNA denominated in UST', 'vote oracle price of LUNA denominated in UST'],
    ['Swapped 1000.123456 UST for 1000.222222 LUNA', 'swap 1000.123456 UST for 1000.222222 LUNA'],
    ['Deposited 123.456789 LUNA to Proposal 1', 'deposit 123.456789 LUNA to Proposal 1'],
    ['Voted yes for proposal 1', 'vote yes for proposal 1'],
    [
      "Created proposal 'To The Moon' with 1000.000000 LUNA deposit",
      "create proposal 'To The Moon' with 1000.000000 LUNA deposit"
    ],
    ['Stored 1', 'store 1'],
    ['Instantiated terra1... from code 1', 'instantiate terra1... from code 1'],
    ['Executed burn on terra1...', 'execute burn on terra1...'],
    ['Migrated terra1... to code 2', 'migrate terra1... to code 2'],
    ['Changed terra1... owner to terra1... from terra1...', 'change terra1... owner to terra1... from terra1...']
  ]

  fixtures.forEach(([origin, expected]) => expect(convertToFailureMessage(origin)).toStrictEqual(expected))
})
