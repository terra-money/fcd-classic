import * as rp from 'request-promise'
import { getContractStore } from 'lib/lcd'

const ASSETS = {
  terra15gwkyepfc6xgca5t5zefzwy42uts8l2m4g40k6: {
    symbol: 'MIR',
    name: 'Mirror',
    token: 'terra15gwkyepfc6xgca5t5zefzwy42uts8l2m4g40k6',
    pair: 'terra1amv303y8kzxuegvurh0gug2xe9wkgj65enq2ux',
    lpToken: 'terra17gjf2zehfvnyjtdgua9p9ygquk6gukxe7ucgwh',
    status: 'LISTED'
  },
  terra1vxtwu4ehgzz77mnfwrntyrmgl64qjs75mpwqaz: {
    symbol: 'mAAPL',
    name: 'Apple',
    token: 'terra1vxtwu4ehgzz77mnfwrntyrmgl64qjs75mpwqaz',
    pair: 'terra1774f8rwx76k7ruy0gqnzq25wh7lmd72eg6eqp5',
    lpToken: 'terra122asauhmv083p02rhgyp7jn7kmjjm4ksexjnks',
    status: 'LISTED'
  },
  terra1h8arz2k547uvmpxctuwush3jzc8fun4s96qgwt: {
    symbol: 'mGOOGL',
    name: 'Google',
    token: 'terra1h8arz2k547uvmpxctuwush3jzc8fun4s96qgwt',
    pair: 'terra1u56eamzkwzpm696hae4kl92jm6xxztar9uhkea',
    lpToken: 'terra1falkl6jy4087h4z567y2l59defm9acmwcs70ts',
    status: 'LISTED'
  },
  terra14y5affaarufk3uscy2vr6pe6w6zqf2wpjzn5sh: {
    symbol: 'mTSLA',
    name: 'Tesla',
    token: 'terra14y5affaarufk3uscy2vr6pe6w6zqf2wpjzn5sh',
    pair: 'terra1pdxyk2gkykaraynmrgjfq2uu7r9pf5v8x7k4xk',
    lpToken: 'terra1ygazp9w7tx64rkx5wmevszu38y5cpg6h3fk86e',
    status: 'LISTED'
  },
  terra1jsxngqasf2zynj5kyh0tgq9mj3zksa5gk35j4k: {
    symbol: 'mNFLX',
    name: 'Netflix',
    token: 'terra1jsxngqasf2zynj5kyh0tgq9mj3zksa5gk35j4k',
    pair: 'terra1yppvuda72pvmxd727knemvzsuergtslj486rdq',
    lpToken: 'terra1mwu3cqzvhygqg7vrsa6kfstgg9d6yzkgs6yy3t',
    status: 'LISTED'
  },
  terra1csk6tc7pdmpr782w527hwhez6gfv632tyf72cp: {
    symbol: 'mQQQ',
    name: 'Invesco QQQ Trust',
    token: 'terra1csk6tc7pdmpr782w527hwhez6gfv632tyf72cp',
    pair: 'terra1dkc8075nv34k2fu6xn6wcgrqlewup2qtkr4ymu',
    lpToken: 'terra16j09nh806vaql0wujw8ktmvdj7ph8h09ltjs2r',
    status: 'LISTED'
  },
  terra1cc3enj9qgchlrj34cnzhwuclc4vl2z3jl7tkqg: {
    symbol: 'mTWTR',
    name: 'Twitter',
    token: 'terra1cc3enj9qgchlrj34cnzhwuclc4vl2z3jl7tkqg',
    pair: 'terra1ea9js3y4l7vy0h46k4e5r5ykkk08zc3fx7v4t8',
    lpToken: 'terra1fc5a5gsxatjey9syq93c2n3xq90n06t60nkj6l',
    status: 'LISTED'
  },
  terra1227ppwxxj3jxz8cfgq00jgnxqcny7ryenvkwj6: {
    symbol: 'mMSFT',
    name: 'Microsoft Corporation',
    token: 'terra1227ppwxxj3jxz8cfgq00jgnxqcny7ryenvkwj6',
    pair: 'terra10ypv4vq67ns54t5ur3krkx37th7j58paev0qhd',
    lpToken: 'terra14uaqudeylx6tegamqmygh85lfq8qg2jmg7uucc',
    status: 'LISTED'
  },
  terra165nd2qmrtszehcfrntlplzern7zl4ahtlhd5t2: {
    symbol: 'mAMZN',
    name: 'Amazon.com',
    token: 'terra165nd2qmrtszehcfrntlplzern7zl4ahtlhd5t2',
    pair: 'terra1vkvmvnmex90wanque26mjvay2mdtf0rz57fm6d',
    lpToken: 'terra1q7m2qsj3nzlz5ng25z5q5w5qcqldclfe3ljup9',
    status: 'LISTED'
  },
  terra1w7zgkcyt7y4zpct9dw8mw362ywvdlydnum2awa: {
    symbol: 'mBABA',
    name: 'Alibaba Group Holdings Ltd ADR',
    token: 'terra1w7zgkcyt7y4zpct9dw8mw362ywvdlydnum2awa',
    pair: 'terra1afdz4l9vsqddwmjqxmel99atu4rwscpfjm4yfp',
    lpToken: 'terra1stfeev27wdf7er2uja34gsmrv58yv397dlxmyn',
    status: 'LISTED'
  },
  terra15hp9pr8y4qsvqvxf3m4xeptlk7l8h60634gqec: {
    symbol: 'mIAU',
    name: 'iShares Gold Trust',
    token: 'terra15hp9pr8y4qsvqvxf3m4xeptlk7l8h60634gqec',
    pair: 'terra1q2cg4sauyedt8syvarc8hcajw6u94ah40yp342',
    lpToken: 'terra1jl4vkz3fllvj6fchnj2trrm9argtqxq6335ews',
    status: 'LISTED'
  },
  terra1kscs6uhrqwy6rx5kuw5lwpuqvm3t6j2d6uf2lp: {
    symbol: 'mSLV',
    name: 'iShares Silver Trust',
    token: 'terra1kscs6uhrqwy6rx5kuw5lwpuqvm3t6j2d6uf2lp',
    pair: 'terra1f6d9mhrsl5t6yxqnr4rgfusjlt3gfwxdveeyuy',
    lpToken: 'terra178cf7xf4r9d3z03tj3pftewmhx0x2p77s0k6yh',
    status: 'LISTED'
  },
  terra1lvmx8fsagy70tv0fhmfzdw9h6s3sy4prz38ugf: {
    symbol: 'mUSO',
    name: 'United States Oil Fund, LP',
    token: 'terra1lvmx8fsagy70tv0fhmfzdw9h6s3sy4prz38ugf',
    pair: 'terra1zey9knmvs2frfrjnf4cfv4prc4ts3mrsefstrj',
    lpToken: 'terra1utf3tm35qk6fkft7ltcnscwml737vfz7xghwn5',
    status: 'LISTED'
  },
  terra1zp3a6q6q4953cz376906g5qfmxnlg77hx3te45: {
    symbol: 'mVIXY',
    name: 'ProShares VIX',
    token: 'terra1zp3a6q6q4953cz376906g5qfmxnlg77hx3te45',
    pair: 'terra1yngadscckdtd68nzw5r5va36jccjmmasm7klpp',
    lpToken: 'terra1cmrl4txa7cwd7cygpp4yzu7xu8g7c772els2y8',
    status: 'LISTED'
  }
}

const ASSETS_BY_SYMBOL: {
  [symbol: string]: {
    symbol: string
    name: string
    token: string
    pair: string
    lpToken: string
    status: string
  }
} = Object.keys(ASSETS).reduce((prev, curr) => {
  prev[ASSETS[curr].symbol.toLowerCase()] = ASSETS[curr]
  return prev
}, {})

export const TOKEN_SYMBOLS = Object.keys(ASSETS).map((address) => ASSETS[address].symbol.toLowerCase())

export const isToken = (symbol: string) => TOKEN_SYMBOLS.includes(symbol.toLowerCase())

async function getMirSupply(): Promise<{ totalSupply: string; circulatingSupply: string }> {
  const res = await rp('https://graph.mirror.finance/graphql', {
    method: 'POST',
    rejectUnauthorized: false,
    body: {
      operationName: 'statistic',
      query: `query statistic {
          statistic {
            mirTotalSupply
            mirCirculatingSupply
          }
        }`,
      variables: {}
    },
    json: true
  })

  if (!res?.data?.statistic) {
    return {
      totalSupply: '',
      circulatingSupply: ''
    }
  }

  return {
    totalSupply: res.data.statistic.mirTotalSupply,
    circulatingSupply: res.data.statistic.mirCirculatingSupply
  }
}

export async function getCirculatingSupply(symbol: string): Promise<string> {
  if (symbol.toLowerCase() === 'mir') {
    return (await getMirSupply()).circulatingSupply
  }

  return getTotalSupply(symbol)
}

export async function getTotalSupply(symbol: string): Promise<string> {
  const lowerCasedSymbol = symbol.toLowerCase()

  if (lowerCasedSymbol === 'mir') {
    return (await getMirSupply()).totalSupply
  }

  const asset = ASSETS_BY_SYMBOL[lowerCasedSymbol]

  if (!asset) {
    return ''
  }

  const res = await getContractStore(asset.token, { token_info: {} })

  if (!res || res.symbol !== asset.symbol || typeof res.total_supply !== 'string') {
    return ''
  }

  return res.total_supply
}
