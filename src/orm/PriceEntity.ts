import { Column, Entity, PrimaryGeneratedColumn, Index, getRepository } from 'typeorm'

@Entity('price')
export default class PriceEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Index('index_price_denom')
  @Column()
  denom: string

  @Index('index_price_datetime')
  @Column()
  datetime: Date

  @Column({ type: 'float' })
  price: number

  static async queryLatestPrices(): Promise<DenomMap> {
    const prices = await getRepository(PriceEntity).find({
      order: {
        datetime: 'DESC'
      },
      take: 100
    })

    return prices.reduce((priceMap: DenomMap, entity: PriceEntity) => {
      if (!priceMap[entity.denom]) {
        priceMap[entity.denom] = entity.price.toString()
      }
      return priceMap
    }, {} as DenomMap)
  }
}
