// TypeORM 의 migration:generate 기능을 이용하려면 ormconfig.js 에서 require 할 수 있어야 하므로
// 불가피하게 TypeScript가 아닌 JavaScript로 모듈화 함
const { DefaultNamingStrategy } = require('typeorm')
const { snakeCase } = require('lodash')

class CamelToSnakeNamingStrategy extends DefaultNamingStrategy {
  tableName(targetName, userSpecifiedName) {
    return userSpecifiedName ? userSpecifiedName : snakeCase(targetName)
  }
  columnName(propertyName, customName, embeddedPrefixes) {
    return snakeCase(embeddedPrefixes.concat(customName ? customName : propertyName).join('_'))
  }
  columnNameCustomized(customName) {
    return customName
  }
  relationName(propertyName) {
    return snakeCase(propertyName)
  }
}

module.exports = CamelToSnakeNamingStrategy
