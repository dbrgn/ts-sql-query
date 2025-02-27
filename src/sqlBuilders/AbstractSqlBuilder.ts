import type { ToSql, SqlBuilder, DeleteData, InsertData, UpdateData, SelectData, SqlOperation, WithQueryData } from "./SqlBuilder"
import type { ITableOrView, __ITableOrViewPrivate } from "../utils/ITableOrView"
import { BooleanValueSource, IfValueSource, ValueSource, __ValueSourcePrivate } from "../expressions/values"
import { Column, isColumn, __ColumnPrivate } from "../utils/Column"
import { CustomBooleanTypeAdapter, DefaultTypeAdapter, TypeAdapter } from "../TypeAdapter"
import type { ConnectionConfiguration } from "../utils/ConnectionConfiguration"
import { SequenceValueSource } from "../internal/ValueSourceImpl"
import { hasToSql, operationOf } from "./SqlBuilder"
import { __getTableOrViewPrivate } from "../utils/ITableOrView"
import { __getColumnOfTable, __getColumnPrivate } from "../utils/Column"
import { QueryRunner } from "../queryRunners/QueryRunner"
import { getWithData } from "./SqlBuilder"
import { __getValueSourcePrivate } from "../expressions/values"

export class AbstractSqlBuilder implements SqlBuilder {
    // @ts-ignore
    _defaultTypeAdapter: DefaultTypeAdapter
    // @ts-ignore
    _queryRunner: QueryRunner
    // @ts-ignore
    _connectionConfiguration: ConnectionConfiguration
    _operationsThatNeedParenthesis: { [operation in keyof SqlOperation]?: boolean }
    constructor() {
        this._operationsThatNeedParenthesis = {
            _equals: true,
            _notEquals: true,
            _is: true,
            _isNot: true,
            _equalsInsensitive: true,
            _notEqualsInsensitive: true,
            _smaller: true,
            _larger: true,
            _smallAs: true,
            _largeAs: true,
            _and: true,
            _or: true,
            _concat: true,
            _add: true,
            _substract: true,
            _multiply: true,
            _divide: true,
            _mod: true,
            _getMilliseconds: true,
            _fragment: true
        }
    }
    _getSafeTableOrView(params: any[]): ITableOrView<any> | undefined {
        return (params as any)._safeTableOrView
    }
    _setSafeTableOrView(params: any[], tableOrView: ITableOrView<any> | undefined): void {
        Object.defineProperty(params, '_safeTableOrView', {
            value: tableOrView,
            writable: true,
            enumerable: false,
            configurable: true
        })
    }
    _isWithGenerated(params: any[]): boolean {
        return !!(params as any)._withGenerated
    }
    _setWithGenerated(params: any[], value: boolean): void {
        Object.defineProperty(params, '_withGenerated', {
            value: value,
            writable: true,
            enumerable: false,
            configurable: true
        })
    }
    _isWithGeneratedFinished(params: any[]): boolean {
        return !!(params as any)._withGeneratedFinished
    }
    _setWithGeneratedFinished(params: any[], value: boolean): void {
        Object.defineProperty(params, '_withGeneratedFinished', {
            value: value,
            writable: true,
            enumerable: false,
            configurable: true
        })
    }
    _isValue(value: any): boolean {
        if (value === null || undefined) {
            return false
        }
        if (!this._connectionConfiguration.allowEmptyString && value === '') {
            return false
        }
        if (Array.isArray(value) && value.length <= 0) {
            return false
        }
        return true
    }
    _isReservedKeyword(_word: string): boolean {
        return false
    }
    _forceAsIdentifier(identifier: string): string {
        return '"' + identifier + '"'
    }
    _escape(identifier: string): string {
        return this._connectionConfiguration.escape(identifier)
    }
    _needParenthesis(value: any): boolean {
        const operation = operationOf(value)
        if (!operation) {
            return false
        }
        if (this._operationsThatNeedParenthesis[operation]) {
            return true
        }
        return false
    }
    _needParenthesisExcluding(value: any, excluding: keyof SqlOperation): boolean {
        const operation = operationOf(value)
        if (!operation) {
            return false
        }
        if (operation === excluding) {
            return false
        }
        if (this._operationsThatNeedParenthesis[operation]) {
            return true
        }
        return false
    }
    _appendColumnName(column: Column, params: any[]): string {
        const columnPrivate = __getColumnPrivate(column)
        const typeAdapter = columnPrivate.__typeAdapter
        if (columnPrivate.__valueType === 'boolean' && typeAdapter instanceof CustomBooleanTypeAdapter) {
            return '(' + this._appendRawColumnName(column, params) + ' = ' + this._appendLiteralValue(typeAdapter.trueValue, params) + ')'
        }
        return this._appendRawColumnName(column, params)
    }
    _appendColumnNameForCondition(column: Column, params: any[]): string {
        const columnPrivate = __getColumnPrivate(column)
        const typeAdapter = columnPrivate.__typeAdapter
        if (columnPrivate.__valueType === 'boolean' && typeAdapter instanceof CustomBooleanTypeAdapter) {
            return this._appendRawColumnName(column, params) + ' = ' + this._appendLiteralValue(typeAdapter.trueValue, params)
        }
        return this._appendRawColumnName(column, params)
    }
    _appendRawColumnName(column: Column, params: any[]): string {
        const columnPrivate = __getColumnPrivate(column)
        const tableOrView = columnPrivate.__table_or_view
        const tablePrivate = __getTableOrViewPrivate(tableOrView)

        if (tablePrivate.__as) {
            return this._escape(tablePrivate.__as) + '.' + this._escape(columnPrivate.__name)
        } else if (this._getSafeTableOrView(params) === tableOrView) {
            return this._escape(columnPrivate.__name)
        } else {
            return this._escape(tablePrivate.__name) + '.' + this._escape(columnPrivate.__name)
        }
    }
    _appendLiteralValue(value: number | string, _params: any[]) {
        if (typeof value === 'number') {
            return '' + value
        } else {
            return "'" + value + "'"
        }
    }
    _getTableOrViewNameInSql(table: ITableOrView<any>): string {
        const t = __getTableOrViewPrivate(table)
        let result = this._escape(t.__name)
        if (t.__as) {
            result += ' as ' + this._escape(t.__as)
        }
        return result
    }
    _appendCondition(condition: BooleanValueSource<any, any> | IfValueSource<any, any>, params: any[]): string {
        if (hasToSql(condition)) {
            return condition.__toSqlForCondition(this, params)
        }
        throw new Error('Conditions must have a __toSqlForCondition method')
    }
    _appendConditionParenthesis(condition: BooleanValueSource<any, any> | IfValueSource<any, any>, params: any[]): string {
        if (this._needParenthesis(condition)) {
            return '(' + this._appendCondition(condition, params) + ')'
        }
        return this._appendCondition(condition, params)
    }
    _appendConditionParenthesisExcuding(condition: BooleanValueSource<any, any> | IfValueSource<any, any>, params: any[], excluding: keyof SqlOperation): string {
        if (this._needParenthesisExcluding(condition, excluding)) {
            return '(' + this._appendCondition(condition, params) + ')'
        }
        return this._appendCondition(condition, params)
    }
    _appendSql(value: ToSql | ValueSource<any, any> | Column, params: any[]): string {
        return (value as ToSql).__toSql(this, params) // All ValueSource or Column have a hidden implemetation of ToSql
    }
    _appendSqlParenthesis(value: ToSql | ValueSource<any, any> | Column, params: any[]): string {
        if (this._needParenthesis(value)) {
            return '(' + this._appendSql(value, params) + ')'
        }
        return this._appendSql(value, params)
    }
    _appendSqlParenthesisExcluding(value: ToSql | ValueSource<any, any> | Column, params: any[], excluding: keyof SqlOperation): string {
        if (this._needParenthesisExcluding(value, excluding)) {
            return '(' + this._appendSql(value, params) + ')'
        }
        return this._appendSql(value, params)
    }
    _appendValue(value: any, params: any[], columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (hasToSql(value)) {
            return this._appendSql(value, params)
        }
        if (Array.isArray(value) && value.length > 0) {
            let arrayResult = '(' + this._appendValue(value[0], params, columnType, typeAdapter)

            for (let i = 1, length = value.length; i < length; i++) {
                arrayResult += ', ' + this._appendValue(value[i], params, columnType, typeAdapter)
            }
            return arrayResult + ')'
        }
        const adaptedValue = this._transformParamToDB(value, columnType, typeAdapter)
        return this._appendParam(adaptedValue, params, columnType)
    }
    _appendValueParenthesis(value: any, params: any[], columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (this._needParenthesis(value)) {
            return '(' + this._appendValue(value, params, columnType, typeAdapter) + ')'
        }
        return this._appendValue(value, params, columnType, typeAdapter)
    }
    _appendValueParenthesisExcluding(value: any, params: any[], columnType: string, typeAdapter: TypeAdapter | undefined, excluding: keyof SqlOperation): string {
        if (this._needParenthesisExcluding(value, excluding)) {
            return '(' + this._appendValue(value, params, columnType, typeAdapter) + ')'
        }
        return this._appendValue(value, params, columnType, typeAdapter)
    }
    _appendConditionSql(value: ToSql | ValueSource<any, any> | Column, params: any[]): string {
        return (value as ToSql).__toSqlForCondition(this, params) // All ValueSource or Column have a hidden implemetation of ToSql
    }
    _appendConditionSqlParenthesis(value: ToSql | ValueSource<any, any> | Column, params: any[]): string {
        if (this._needParenthesis(value)) {
            return '(' + this._appendConditionSql(value, params) + ')'
        }
        return this._appendConditionSql(value, params)
    }
    _appendConditionSqlParenthesisExcluding(value: ToSql | ValueSource<any, any> | Column, params: any[], excluding: keyof SqlOperation): string {
        if (this._needParenthesisExcluding(value, excluding)) {
            return '(' + this._appendConditionSql(value, params) + ')'
        }
        return this._appendConditionSql(value, params)
    }
    _appendConditionValue(value: any, params: any[], columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (hasToSql(value)) {
            return this._appendConditionSql(value, params)
        }
        if (Array.isArray(value) && value.length > 0) {
            let arrayResult = '(' + this._appendConditionValue(value[0], params, columnType, typeAdapter)

            for (let i = 1, length = value.length; i < length; i++) {
                arrayResult += ', ' + this._appendConditionValue(value[i], params, columnType, typeAdapter)
            }
            return arrayResult + ')'
        }
        const adaptedValue = this._transformParamToDB(value, columnType, typeAdapter)
        return this._appendConditionParam(adaptedValue, params, columnType)
    }
    _appendConditionValueParenthesis(value: any, params: any[], columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (this._needParenthesis(value)) {
            return '(' + this._appendConditionValue(value, params, columnType, typeAdapter) + ')'
        }
        return this._appendConditionValue(value, params, columnType, typeAdapter)
    }
    _appendConditionValueParenthesisExcluding(value: any, params: any[], columnType: string, typeAdapter: TypeAdapter | undefined, excluding: keyof SqlOperation): string {
        if (this._needParenthesisExcluding(value, excluding)) {
            return '(' + this._appendConditionValue(value, params, columnType, typeAdapter) + ')'
        }
        return this._appendConditionValue(value, params, columnType, typeAdapter)
    }
    _transformParamToDB(value: any, columnType: string, typeAdapter: TypeAdapter | undefined): any {
        if (typeAdapter) {
            return typeAdapter.transformValueToDB(value, columnType, this._defaultTypeAdapter)
        } else {
            return this._defaultTypeAdapter.transformValueToDB(value, columnType)
        }
    }
    _appendParam(value: any, params: any[], _columnType: string): string {
        return this._queryRunner.addParam(params, value)
    }
    _appendConditionParam(value: any, params: any[], columnType: string): string {
        return this._appendParam(value, params, columnType)
    }
    _appendColumnAlias(name: string, _params: any[]): string {
        return this._escape(name)
    }
    _buildWith(withData: WithQueryData, params: any[]): string {
        if (this._isWithGenerated(params)) {
            return ''
        }
        this._setWithGenerated(params, true)
        const withs = withData.__withs
        if (withs.length <= 0) {
            this._setWithGeneratedFinished(params, true)
            return ''
        }
        let result = ''
        for (let i = 0, length = withs.length; i < length; i++) {
            if (result) {
                result += ', '
            }
            const withView = getWithData(withs[i]!)
            result += withView.__name
            result += ' as ('
            result += this._buildSelect(withView.__selectData, params)
            result += ')'
        }
        this._setWithGeneratedFinished(params, true)
        return 'with ' + result + ' '
    }
    _buildSelect(query: SelectData, params: any[]): string {
        return this._buildSelectWithColumnsInfo(query, params, {})
    }
    _buildSelectWithColumnsInfo(query: SelectData, params: any[], columnsForInsert: { [name: string]: Column | undefined }): string {
        const oldSafeTableOrView = this._getSafeTableOrView(params)

        const tables = query.__tables_or_views
        const tablesLength = tables.length
        const joins = query.__joins
        const joinsLength = joins.length

        if (tablesLength === 1 && joinsLength <= 0) {
            this._setSafeTableOrView(params, tables[0])
        } else {
            this._setSafeTableOrView(params, undefined)
        }

        const withClause = this._buildWith(query, params)
        let selectQuery = withClause + 'select '
        if (query.__distinct) {
            selectQuery += 'distinct '
        }

        const columns = query.__columns
        let requireComma = false
        for (const property in columns) {
            if (requireComma) {
                selectQuery += ', '
            }
            const columnForInsert = columnsForInsert[property]
            selectQuery += this._appendSelectColumn(columns[property]!, params, columnForInsert)
            if (property) {
                selectQuery += ' as ' + this._appendColumnAlias(property, params)
            }
            requireComma = true
        }

        if (tablesLength <= 0) {
            selectQuery += this._fromNoTable()
        } else {
            selectQuery += ' from '
            requireComma = false
            for (let i = 0; i < tablesLength; i++) {
                if (requireComma) {
                    selectQuery += ', '
                }
                selectQuery += this._getTableOrViewNameInSql(tables[i]!)
                requireComma = true
            }
        }

        if (joinsLength > 0) {
            for (let i = 0; i < joinsLength; i++) {
                const join = joins[i]!
                switch (join.__joinType) {
                    case 'join':
                        selectQuery += ' join '
                        break
                    case 'innerJoin':
                        selectQuery += ' inner join '
                        break
                    case 'leftJoin':
                        selectQuery += ' left join '
                        break
                    case 'leftOuterJoin':
                        selectQuery += ' letf outer join '
                }
                selectQuery += this._getTableOrViewNameInSql(join.__table_or_view)
                if (join.__on) {
                    const onCondition = this._appendCondition(join.__on, params)
                    if (onCondition) {
                        selectQuery += ' on ' + onCondition
                    }
                }
            }
        }

        const where = query.__where
        if (where) {
            const whereCondition = this._appendCondition(where, params)
            if (whereCondition) {
                selectQuery += ' where ' + whereCondition
            }
        }

        requireComma = false
        const groupBy = query.__groupBy
        for (let i = 0, length = groupBy.length; i < length; i++) {
            if (requireComma) {
                selectQuery += ', '
            } else {
                selectQuery += ' group by '
            }
            selectQuery += this._appendSelectColumn(groupBy[i]!, params, undefined)
            requireComma = true
        }

        const having = query.__having
        if (having) {
            const havingCondition = this._appendCondition(having, params)
            if (havingCondition) {
                selectQuery += ' having ' + havingCondition
            }
        }

        selectQuery += this._buildSelectOrderBy(query, params)
        selectQuery += this._buildSelectLimitOffset(query, params)

        this._setSafeTableOrView(params, oldSafeTableOrView)
        return selectQuery
    }
    _appendSelectColumn(value: ValueSource<any, any>, params: any[], columnForInsert: Column | undefined): string {
        if (columnForInsert) {
            const sql = this._appendCustomBooleanRemapForColumnIfRequired(columnForInsert, value, params)
            if (sql) {
                return sql
            }
        }
        return this._appendSql(value, params)
    }
    _fromNoTable() {
        return ''
    }
    _buildSelectOrderBy(query: SelectData, params: any[]): string {
        const orderBy = query.__orderBy
        if (!orderBy) {
            return ''
        }
        const columns = query.__columns
        let orderByColumns = ''
        for (const property in orderBy) {
            if (orderByColumns) {
                orderByColumns += ', '
            }
            const column = columns[property]
            if (!column) {
                throw new Error('Column ' + property + ' included in the order by not found in the select clause')
            }
            const columnAlias = this._appendColumnAlias(property, params)
            const order = orderBy[property]
            if (!order) {
                orderByColumns += columnAlias
            } else switch (order) {
                case 'asc':
                case 'desc': 
                case 'asc nulls first':
                case 'asc nulls last':
                case 'desc nulls first':
                case 'desc nulls last' :
                    orderByColumns += columnAlias + ' ' + order
                    break
                case 'insensitive':
                case 'asc insensitive':
                case 'desc insensitive':
                case 'asc nulls first insensitive':
                case 'asc nulls last insensitive':
                case 'desc nulls first insensitive':
                case 'desc nulls last insensitive': {
                    let sqlOrder = order.substring(0, order.length - 12)
                    if (sqlOrder) {
                        sqlOrder = ' ' + sqlOrder
                    }
                    const collation = this._connectionConfiguration.insesitiveCollation
                    const columnType = __getValueSourcePrivate(column).__valueType
                    if (columnType != 'string') {
                        // Ignore the insensitive term, it do nothing
                        orderByColumns += columnAlias + ' ' + sqlOrder
                    } else if (collation) {
                        orderByColumns += columnAlias + ' collate ' + collation + sqlOrder
                    } else if (collation === '') {
                        orderByColumns += columnAlias + sqlOrder
                    } else {
                        orderByColumns += 'lower(' + columnAlias + ')' + sqlOrder
                    }
                    break
                }
                default:
                    throw new Error('Invalid order by: ' + property + ' ' + order)
            }
        }

        if (!orderByColumns) {
            return ''
        }
        return ' order by ' + orderByColumns
    }
    _buildSelectLimitOffset(query: SelectData, params: any[]): string {
        let result = ''

        const offset = query.__offset
        if (offset !== null && offset !== undefined) {
            result += ' offset ' + this._appendValue(offset, params, 'int', undefined) + ' rows'
        }
        const limit = query.__limit
        if (limit !== null && limit !== undefined) {
            result += ' fetch next ' + this._appendValue(limit, params, 'int', undefined) + ' rows only'
        }
        return result
    }
    _buildInsertMultiple(query: InsertData, params: any[]): string {
        const multiple = query.__multiple
        if (!multiple) {
            throw new Error('Exepected a multiple insert')
        }
        if (multiple.length <= 0) {
            return ''
        }

        const oldSafeTableOrView = this._getSafeTableOrView(params)
        const table = query.__table
        this._setSafeTableOrView(params, table)

        const usedColumns: { [name: string]: boolean | undefined } = {}
        for (let i = 0, length = multiple.length; i < length; i++) {
            const sets = multiple[i]
            const properties = Object.getOwnPropertyNames(sets)
            for (let j = 0, length = properties.length; j < length; j++) {
                const columnName = properties[j]!
                usedColumns[columnName] = true
            }
        }

        let columns = ''
        let multipleValues = ''

        const nextSequenceValues: string[] = []
        for (var columnName in table) {
            const column = __getColumnOfTable(table, columnName)
            if (!column) {
                continue
            }
            const columnPrivate = __getColumnPrivate(column)
            if (!columnPrivate.__sequenceName) {
                continue
            }

            if (columns) {
                columns += ', '
            }

            columns += this._appendRawColumnName(column, params)
            nextSequenceValues.push(columnPrivate.__sequenceName)
        }

        for (let columnName in usedColumns) {
            if (columns) {
                columns += ', '
            }
            const column = __getColumnOfTable(table, columnName)
            if (column) {
                columns += this._appendRawColumnName(column, params)
            } else {
                throw new Error('Unable to find the column "' + columnName + ' in the table "' + this._getTableOrViewNameInSql(table) +'". The column is not included in the table definition')
            }
        }

        for (let i = 0, length = multiple.length; i < length; i++) {
            let values = ''
            for (let j = 0, length = nextSequenceValues.length; j < length; j++) {
                if (values) {
                    values += ', '
                }
                const sequenceName = nextSequenceValues[j]!
                values += this._nextSequenceValue(params, sequenceName)
            }

            const sets = multiple[i]!

            for (let columnName in usedColumns) {
                if (values) {
                    values += ', '
                }

                const value = sets[columnName]
                const column = __getColumnOfTable(table, columnName)
                if (column) {
                    const columnPrivate = __getColumnPrivate(column)
                    const sequenceName = columnPrivate.__sequenceName
                    if (!(columnName in sets) && sequenceName) {
                        values += this._nextSequenceValue(params, sequenceName)
                    } else {
                        values += this._appendValueForColumn(column, value, params)
                    }
                } else {
                    throw new Error('Unable to find the column "' + columnName + ' in the table "' + this._getTableOrViewNameInSql(table) +'". The column is not included in the table definition')
                }
            }

            if (multipleValues) {
                multipleValues += ', (' + values + ')'
            } else {
                multipleValues = '(' + values + ')'
            }
        }

        const insertQuery = 'insert into ' + this._getTableOrViewNameInSql(table) + ' (' + columns + ')' + this._buildInsertOutput(query, params) + ' values ' + multipleValues+ this._buildInsertReturning(query, params)

        this._setSafeTableOrView(params, oldSafeTableOrView)
        return insertQuery
    }
    _appendCustomBooleanRemapForColumnIfRequired(column: Column, value: any, params: any[]): string | null {
        const columnPrivate = __getColumnPrivate(column)
        const columnTypeAdapter = columnPrivate.__typeAdapter
        const columnType = columnPrivate.__valueType

        if (columnType !== 'boolean') {
            return null // non-boolean
        }
        
        if (columnTypeAdapter instanceof CustomBooleanTypeAdapter) {
            if (isColumn(value)) {
                const valuePrivate = __getColumnPrivate(value)
                const valueTypeAdapter = valuePrivate.__typeAdapter

                if (valueTypeAdapter instanceof CustomBooleanTypeAdapter) {
                    if (columnTypeAdapter.trueValue === valueTypeAdapter.trueValue && columnTypeAdapter.falseValue === valueTypeAdapter.falseValue) {
                        return this._appendRawColumnName(value, params) // same boolean as column
                    }

                    if (!columnPrivate.__isOptional) {
                        // remapped
                        return 'case when ' + this._appendRawColumnName(value, params) + ' = ' + this._appendLiteralValue(valueTypeAdapter.trueValue, params) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' else ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' end'
                    } else {
                        // remapped
                        return 'case when ' + this._appendRawColumnName(value, params) + ' = ' + this._appendLiteralValue(valueTypeAdapter.trueValue, params) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' when ' + this._appendRawColumnName(value, params) + ' = ' + this._appendLiteralValue(valueTypeAdapter.falseValue, params) + ' then ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' else null end'
                    }
                }
            }

            if (!columnPrivate.__isOptional) {
                // remapped
                return 'case when ' + this._appendConditionValue(value, params, columnType, columnTypeAdapter) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' else ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' end'
            } else {
                // remapped
                return 'case when ' + this._appendConditionValue(value, params, columnType, columnTypeAdapter) + ' then ' + this._appendLiteralValue(columnTypeAdapter.trueValue, params) + ' when not ' + this._appendValue(value, params, columnType, columnTypeAdapter) + ' then ' + this._appendLiteralValue(columnTypeAdapter.falseValue, params) + ' else null end'
            }
        }

        // if value is column and its type adapter is CustomBooleanTypeAdapter append value will be required to normalize value
        // if not it is same boolean, nothing to transform here
        return null
    }
    _appendValueForColumn(column: Column, value: any, params: any[]): string {
        const sql = this._appendCustomBooleanRemapForColumnIfRequired(column, value, params)
        if (sql) {
            return sql
        }
        const columnPrivate = __getColumnPrivate(column)
        return this._appendValue(value, params, columnPrivate.__valueType, columnPrivate.__typeAdapter)
    }
    _buildInsertDefaultValues(query: InsertData, params: any[]): string {
        const oldSafeTableOrView = this._getSafeTableOrView(params)

        const table = query.__table

        this._setSafeTableOrView(params, table)

        const withClause = this._buildWith(query, params)

        let columns = ''
        let values = ''

        for (var columnName in table) {
            const column = __getColumnOfTable(table, columnName)
            if (!column) {
                continue
            }
            const columnPrivate = __getColumnPrivate(column)
            if (!columnPrivate.__sequenceName) {
                continue
            }

            if (columns) {
                columns += ', '
                values += ', '
            }

            columns += this._appendRawColumnName(column, params)
            values += this._nextSequenceValue(params, columnPrivate.__sequenceName)
        }

        const tableName = this._getTableOrViewNameInSql(table)
        let insertQuery: string
        if (columns) {
            insertQuery = withClause + 'insert into ' + tableName + ' (' + columns + ')' + this._buildInsertOutput(query, params) + ' values (' + values + ')' + this._buildInsertReturning(query, params)
        } else {
            insertQuery = withClause + 'insert into ' + tableName + this._buildInsertOutput(query, params) + ' default values' + this._buildInsertReturning(query, params)
        }

        this._setSafeTableOrView(params, oldSafeTableOrView)
        return insertQuery
    }
    _buildInsert(query: InsertData, params: any[]): string {
        const oldSafeTableOrView = this._getSafeTableOrView(params)

        const table = query.__table
        const sets = query.__sets

        this._setSafeTableOrView(params, table)

        const withClause = this._buildWith(query, params)

        let columns = ''
        let values = ''

        for (var columnName in table) {
            if (columnName in sets) {
                continue
            }
            const column = __getColumnOfTable(table, columnName)
            if (!column) {
                continue
            }
            const columnPrivate = __getColumnPrivate(column)
            if (!columnPrivate.__sequenceName) {
                continue
            }

            if (columns) {
                columns += ', '
                values += ', '
            }

            columns += this._appendRawColumnName(column, params)
            values += this._nextSequenceValue(params, columnPrivate.__sequenceName)
        }

        const properties = Object.getOwnPropertyNames(sets)
        for (let i = 0, length = properties.length; i < length; i++) {
            if (columns) {
                columns += ', '
                values += ', '
            }

            const property = properties[i]!
            const value = sets[property]
            const column = __getColumnOfTable(table, property)
            if (column) {
                columns += this._appendRawColumnName(column, params)
                values += this._appendValueForColumn(column, value, params)
            } else {
                throw new Error('Unable to find the column "' + property + ' in the table "' + this._getTableOrViewNameInSql(table) +'". The column is not included in the table definition')
            }
        }

        const insertQuery = withClause + 'insert into ' + this._getTableOrViewNameInSql(table) + ' (' + columns + ')' + this._buildInsertOutput(query, params) + ' values (' + values + ')' + this._buildInsertReturning(query, params)

        this._setSafeTableOrView(params, oldSafeTableOrView)
        return insertQuery
    }
    _buildInsertFromSelect(query: InsertData, params: any[]): string {
        const from = query.__from
        if (!from) {
            throw new Error('Exepected an insert from a subquery')
        }

        const oldSafeTableOrView = this._getSafeTableOrView(params)

        const table = query.__table
        const selectColumns = from.__columns

        this._setSafeTableOrView(params, table)

        const withClause = this._buildWith(query, params)

        const columnsForInsert: { [name: string]: Column | undefined } = {}

        let columns = ''
        const addedColumns: string[] = []
        for (var columnName in table) {
            if (columnName in selectColumns) {
                continue
            }
            const column = __getColumnOfTable(table, columnName)
            if (!column) {
                continue
            }
            const columnPrivate = __getColumnPrivate(column)
            if (!columnPrivate.__sequenceName) {
                continue
            }

            addedColumns.push(columnName)
            columnsForInsert[columnName] = column
            selectColumns[columnName] = new SequenceValueSource('_nextSequenceValue', columnPrivate.__sequenceName, columnPrivate.__valueType, columnPrivate.__typeAdapter)
        }

        const properties = Object.getOwnPropertyNames(selectColumns)
        for (let i = 0, length = properties.length; i < length; i++) {
            if (columns) {
                columns += ', '
            }

            const property = properties[i]!
            const column = __getColumnOfTable(table, property)
            if (column) {
                columns += this._appendRawColumnName(column, params)
                columnsForInsert[property] = column
            } else {
                throw new Error('Unable to find the column "' + property + ' in the table "' + this._getTableOrViewNameInSql(table) +'". The column is not included in the table definition')
            }
        }

        const insertQuery = withClause + 'insert into ' + this._getTableOrViewNameInSql(table) + ' (' + columns + ')' + this._buildInsertOutput(query, params) + ' ' + this._buildSelectWithColumnsInfo(from, params, columnsForInsert) + this._buildInsertReturning(query, params)

        for (let i = 0, length = addedColumns.length; i < length; i++) {
            const columnName = addedColumns[i]!
            delete selectColumns[columnName]
        }

        this._setSafeTableOrView(params, oldSafeTableOrView)
        return insertQuery
    }
    _buildInsertOutput(_query: InsertData, _params: any[]): string {
        return ''
    }
    _buildInsertReturning(query: InsertData, params: any[]): string {
        const idColumn = query.__idColumn
        if (!idColumn) {
            return ''
        }
        return ' returning ' + this._appendSql(idColumn, params)
    }
    _nextSequenceValue( _params: any[], sequenceName: string) {
        return "nextval('" + this._escape(sequenceName) + "')"
    }
    _currentSequenceValue(_params: any[], sequenceName: string): string {
        return "currval('" + this._escape(sequenceName) + "')"
    }
    _buildUpdate(query: UpdateData, params: any[]): string {
        const oldSafeTableOrView = this._getSafeTableOrView(params)

        const table = query.__table
        const sets = query.__sets

        this._setSafeTableOrView(params, table)

        const withClause = this._buildWith(query, params)

        let columns = ''
        const properties = Object.getOwnPropertyNames(sets)
        for (let i = 0, length = properties.length; i < length; i++) {
            if (columns) {
                columns += ', '
            }

            const property = properties[i]!
            const value = sets[property]
            const column = __getColumnOfTable(table, property)
            if (column) {
                columns += this._appendRawColumnName(column, params)
                columns += ' = '
                columns += this._appendValueForColumn(column, value, params)
            } else {
                throw new Error('Unable to find the column "' + property + ' in the table "' + this._getTableOrViewNameInSql(table) +'". The column is not included in the table definition')
            }
        }

        let updateQuery = withClause + 'update ' + this._getTableOrViewNameInSql(table) + ' set ' + columns
        if (query.__where) {
            const whereCondition = this._appendCondition(query.__where, params)
            if (whereCondition) {
                updateQuery += ' where ' + whereCondition
            } else if (!query.__allowNoWhere) {
                throw new Error('No where defined for the update operation')
            }
        } else if (!query.__allowNoWhere) {
            throw new Error('No where defined for the update operation')
        }

        this._setSafeTableOrView(params, oldSafeTableOrView)
        return updateQuery
    }
    _buildDelete(query: DeleteData, params: any[]): string {
        const oldSafeTableOrView = this._getSafeTableOrView(params)

        const withClause = this._buildWith(query, params)

        const table = query.__table
        this._setSafeTableOrView(params, table)

        let deleteQuery = withClause + 'delete from ' + this._getTableOrViewNameInSql(table)
        if (query.__where) {
            const whereCondition = this._appendCondition(query.__where, params)
            if (whereCondition) {
                deleteQuery += ' where ' + whereCondition
            } else if (!query.__allowNoWhere) {
                throw new Error('No where defined for the delete operation')
            }
        } else if (!query.__allowNoWhere) {
            throw new Error('No where defined for the delete operation')
        }

        this._setSafeTableOrView(params, oldSafeTableOrView)
        return deleteQuery
    }

    /*
     * Comparators
     */
    // SqlComparator0
    _isNull(params: any[], valueSource: ToSql): string {
        return this._appendSqlParenthesis(valueSource, params) + ' is null'
    }
    _isNotNull(params: any[], valueSource: ToSql): string {
        return this._appendSqlParenthesis(valueSource, params) + ' is not null'
    }
    _hasSameBooleanTypeAdapter(valueSource: Column, value: Column): valueSource is Column  {
        if (isColumn(valueSource) && isColumn(value)) {
            const valueSourcePrivate = __getColumnPrivate(valueSource)
            const valuePrivate = __getColumnPrivate(value)
            if (valueSourcePrivate.__valueType === 'boolean' && valuePrivate.__valueType === 'boolean') {
                const valueSourceTypeAdapter = valueSourcePrivate.__typeAdapter
                const valueTypeAdapter = valuePrivate.__typeAdapter
                if (valueSourceTypeAdapter instanceof CustomBooleanTypeAdapter && valueTypeAdapter instanceof CustomBooleanTypeAdapter) {
                    return valueSourceTypeAdapter.trueValue === valueTypeAdapter.trueValue && valueSourceTypeAdapter.falseValue === valueTypeAdapter.falseValue
                }
            }
        }
        return false
    }
    // SqlComparator1
    _equals(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (isColumn(valueSource) && isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return this._appendRawColumnName(valueSource, params) + ' = ' + this._appendRawColumnName(value, params)
        }
        return this._appendSqlParenthesis(valueSource, params) + ' = ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
    }
    _notEquals(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (isColumn(valueSource) && isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return this._appendRawColumnName(valueSource, params) + ' <> ' + this._appendRawColumnName(value, params)
        }
        return this._appendSqlParenthesis(valueSource, params) + ' <> ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
    }
    _is(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (isColumn(valueSource) && isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return this._appendRawColumnName(valueSource, params) + ' is not distinct from ' + this._appendRawColumnName(value, params)
        }
        return this._appendSqlParenthesis(valueSource, params) + ' is not distinct from ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
    }
    _isNot(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (isColumn(valueSource) && isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return this._appendRawColumnName(valueSource, params) + ' is distinct from ' + this._appendRawColumnName(value, params)
        }
        return this._appendSqlParenthesis(valueSource, params) + ' is distinct from ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
    }
    _equalsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' = ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ' collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + ' = ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ') = lower(' + this._appendValue(value, params, columnType, typeAdapter) + ')'
        }
    }
    _notEqualsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' <> ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ' collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + ' <> ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ') <> lower(' + this._appendValue(value, params, columnType, typeAdapter) + ')'
        }
    }
    _smaller(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' < ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
    }
    _larger(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' > ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
    }
    _smallAs(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' <= ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
    }
    _largeAs(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' >= ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
    }
    _in(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (Array.isArray(value)) {
            return this._appendSqlParenthesis(valueSource, params) + ' in ' + this._appendValue(value, params, columnType, typeAdapter)
        } else {
            return this._appendSqlParenthesis(valueSource, params) + ' in (' + this._appendValue(value, params, columnType, typeAdapter) + ')'
        }
    }
    _notIn(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (Array.isArray(value)) {
            return this._appendSqlParenthesis(valueSource, params) + ' not in ' + this._appendValue(value, params, columnType, typeAdapter)
        } else {
            return this._appendSqlParenthesis(valueSource, params) + ' not in (' + this._appendValue(value, params, columnType, typeAdapter) + ')'
        }
    }
    _like(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' like ' + this._appendValue(value, params, columnType, typeAdapter)
    }
    _notLike(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' not like ' + this._appendValue(value, params, columnType, typeAdapter)
    }
    _likeInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' like ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ' collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + ' like ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ') like lower(' + this._appendValue(value, params, columnType, typeAdapter) + ')'
        }
    }
    _notLikeInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' not like ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ' collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + ' not like ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ') not like lower(' + this._appendValue(value, params, columnType, typeAdapter) + ')'
        }
    }
    _startWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' like (' + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%')"
    }
    _notStartWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' not like (' + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%')"
    }
    _endWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ')'
    }
    _notEndWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " not like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ')'
    }
    _startWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' like (' + this._escapeLikeWildcard(value, params, columnType, typeAdapter) + " || '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + ' like (' + this._escapeLikeWildcard(value, params, columnType, typeAdapter) + " || '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ') like lower(' + this._escapeLikeWildcard(value, params, columnType, typeAdapter) + " || '%')"
        }
    }
    _notStartWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + ' not like (' + this._escapeLikeWildcard(value, params, columnType, typeAdapter) + " || '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + ' not like (' + this._escapeLikeWildcard(value, params, columnType, typeAdapter) + " || '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ') not like lower(' + this._escapeLikeWildcard(value, params, columnType, typeAdapter) + " || '%')"
        }
    }
    _endWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ') collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ')'
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ") like lower('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ')'
        }
    }
    _notEndWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + " not like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ') collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + " not like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ')'
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ") not like lower('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + ')'
        }
    }
    _contains(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%')"
    }
    _notContains(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + " not like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%')"
    }
    _containsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + " like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ") like lower('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%')"
        }
    }
    _notContainsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insesitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params) + " not like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params) + " not like ('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, params) + ") not like lower('%' || " + this._escapeLikeWildcard(params, value, columnType, typeAdapter) + " || '%')"
        }
    }
    // SqlComparator2
    _between(params: any[], valueSource: ToSql, value: any, value2: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' between ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ' and ' + this._appendValueParenthesis(value2, params, columnType, typeAdapter)
    }
    _notBetween(params: any[], valueSource: ToSql, value: any, value2: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' not between ' + this._appendValueParenthesis(value, params, columnType, typeAdapter) + ' and ' + this._appendValueParenthesis(value2, params, columnType, typeAdapter)
    }
    // SqlOperationStatic0
    _pi(_params: any): string {
        return 'pi()'
    }
    _random(_params: any): string {
        return 'random()'
    }
    _currentDate(_params: any): string {
        return 'current_date'
    }
    _currentTime(_params: any): string {
        return 'current_time'
    }
    _currentTimestamp(_params: any): string {
        return 'current_timestamp'
    }
    _default(_params: any): string {
        return 'default'
    }
    _trueValue = 'true'
    _true(_params: any): string {
        return this._trueValue
    }
    _trueValueForCondition = 'true'
    _trueForCondition(_params: any): string {
        return this._trueValueForCondition
    }
    _falseValue = 'false'
    _false(_params: any): string {
        return this._falseValue
    }
    _falseValueForCondition = 'false'
    _falseForCondition(_params: any): string {
        return this._falseValueForCondition
    }
    // SqlOperationStatic01
    _const(params: any[], value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendValue(value, params, columnType, typeAdapter)
    }
    _constForCondition(params: any[], value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendConditionValue(value, params, columnType, typeAdapter)
    }
    _exists(params: any[], value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'exists(' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    _notExists(params: any[], value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'not exists(' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    _escapeLikeWildcard(params: any[], value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        if (typeof value === 'string') {
            value = value.replace(/\\/g, '\\\\')
            value = value.replace(/%/g, '\\%')
            value = value.replace(/_/g, '\\_')
            return this._appendValue(value, params, columnType, typeAdapter)
        } else {
            return "replace(replace(replace(" + this._appendValue(value, params, columnType, typeAdapter) + ", '\\', '\\\\'), '%', '\\%'), '_', '\\_')"
        }
    }
    // SqlFunctions0
    _negate(params: any[], valueSource: ToSql): string {
        return 'not ' + this._appendConditionSqlParenthesis(valueSource, params)
    }
    _lower(params: any[], valueSource: ToSql): string {
        return 'lower(' + this._appendSql(valueSource, params) + ')'
    }
    _upper(params: any[], valueSource: ToSql): string {
        return 'upper(' + this._appendSql(valueSource, params) + ')'
    }
    _length(params: any[], valueSource: ToSql): string {
        return 'length(' + this._appendSql(valueSource, params) + ')'
    }
    _trim(params: any[], valueSource: ToSql): string {
        return 'trim(' + this._appendSql(valueSource, params) + ')'
    }
    _ltrim(params: any[], valueSource: ToSql): string {
        return 'ltrim(' + this._appendSql(valueSource, params) + ')'
    }
    _rtrim(params: any[], valueSource: ToSql): string {
        return 'rtrim(' + this._appendSql(valueSource, params) + ')'
    }
    _reverse(params: any[], valueSource: ToSql): string {
        return 'reverse(' + this._appendSql(valueSource, params) + ')'
    }
    _asDouble(params: any[], valueSource: ToSql): string {
        return 'cast(' + this._appendSql(valueSource, params) + 'as double presition)'
    }
    _abs(params: any[], valueSource: ToSql): string {
        return 'abs(' + this._appendSql(valueSource, params) + ')'
    }
    _ceil(params: any[], valueSource: ToSql): string {
        return 'ceil(' + this._appendSql(valueSource, params) + ')'
    }
    _floor(params: any[], valueSource: ToSql): string {
        return 'floor(' + this._appendSql(valueSource, params) + ')'
    }
    _round(params: any[], valueSource: ToSql): string {
        return 'round(' + this._appendSql(valueSource, params) + ')'
    }
    _exp(params: any[], valueSource: ToSql): string {
        return 'exp(' + this._appendSql(valueSource, params) + ')'
    }
    _ln(params: any[], valueSource: ToSql): string {
        return 'ln(' + this._appendSql(valueSource, params) + ')'
    }
    _log10(params: any[], valueSource: ToSql): string {
        return 'log(' + this._appendSql(valueSource, params) + ')'
    }
    _sqrt(params: any[], valueSource: ToSql): string {
        return 'sqtr(' + this._appendSql(valueSource, params) + ')'
    }
    _cbrt(params: any[], valueSource: ToSql): string {
        return 'cbrt(' + this._appendSql(valueSource, params) + ')'
    }
    _sign(params: any[], valueSource: ToSql): string {
        return 'sign(' + this._appendSql(valueSource, params) + ')'
    }
    _acos(params: any[], valueSource: ToSql): string {
        return 'acos(' + this._appendSql(valueSource, params) + ')'
    }
    _asin(params: any[], valueSource: ToSql): string {
        return 'asin(' + this._appendSql(valueSource, params) + ')'
    }
    _atan(params: any[], valueSource: ToSql): string {
        return 'atan(' + this._appendSql(valueSource, params) + ')'
    }
    _cos(params: any[], valueSource: ToSql): string {
        return 'cos(' + this._appendSql(valueSource, params) + ')'
    }
    _cot(params: any[], valueSource: ToSql): string {
        return 'cot(' + this._appendSql(valueSource, params) + ')'
    }
    _sin(params: any[], valueSource: ToSql): string {
        return 'sin(' + this._appendSql(valueSource, params) + ')'
    }
    _tan(params: any[], valueSource: ToSql): string {
        return 'tan(' + this._appendSql(valueSource, params) + ')'
    }
    _getDate(params: any[], valueSource: ToSql): string {
        return 'extract(day from ' + this._appendSql(valueSource, params) + ')'
    }
    _getTime(params: any[], valueSource: ToSql): string {
        return 'round(extract(epoch from ' + this._appendSql(valueSource, params) + ') * 1000)'
    }
    _getFullYear(params: any[], valueSource: ToSql): string {
        return 'extract(year from ' + this._appendSql(valueSource, params) + ')'
    }
    _getMonth(params: any[], valueSource: ToSql): string {
        return 'extract(month from ' + this._appendSql(valueSource, params) + ')'
    }
    _getDay(params: any[], valueSource: ToSql): string {
        return 'extract(dow from ' + this._appendSql(valueSource, params) + ')'
    }
    _getHours(params: any[], valueSource: ToSql): string {
        return 'extract(hour from ' + this._appendSql(valueSource, params) + ')'
    }
    _getMinutes(params: any[], valueSource: ToSql): string {
        return 'extract(minute from ' + this._appendSql(valueSource, params) + ')'
    }
    _getSeconds(params: any[], valueSource: ToSql): string {
        return 'extract(second from ' + this._appendSql(valueSource, params) + ')'
    }
    _getMilliseconds(params: any[], valueSource: ToSql): string {
        return 'extract(millisecond from ' + this._appendSql(valueSource, params) + ') % 1000'
    }
    // SqlFunction1
    _valueWhenNull(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'coalesce(' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    _and(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const sql = valueSource.__toSqlForCondition(this, params)
        const sql2 = this._appendConditionValue(value, params, columnType, typeAdapter)
        if (!sql || sql === this._trueValueForCondition) {
            // sql === this._trueValueForCondition reduce unnecesary ands allowing dynamic queries
            return sql2
        } else if (!sql2 || sql2 === this._trueValueForCondition) {
            // sql2 === this._trueValueForCondition reduce unnecesary ands allowing dynamic queries
            return sql
        } else {
            let result
            if (operationOf(valueSource) === '_or') {
                result = '(' + sql + ')'
            } else {
                result = sql
            }
            result += ' and '
            if (operationOf(value) === '_or') {
                result += '(' + sql2 + ')'
            } else {
                result += sql2
            }
            return result
        }
    }
    _or(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        const sql = valueSource.__toSqlForCondition(this, params)
        const sql2 = this._appendConditionValue(value, params, columnType, typeAdapter)
        if (!sql || sql === this._falseValueForCondition) {
            // !sql || sql === this._falseValueForCondition reduce unnecesary ors allowing dynamic queries
            return sql2
        } else if (!sql2 || sql2 === this._falseValueForCondition) {
            // !sql2 || sql2 === this._falseValueForCondition reduce unnecesary ors allowing dynamic queries
            return sql
        } else {
            let result
            if (operationOf(valueSource) === '_and') {
                result = '(' + sql + ')'
            } else {
                result = sql
            }
            result += ' or '
            if (operationOf(value) === '_and') {
                result += '(' + sql2 + ')'
            } else {
                result += sql2
            }
            return result
        }
    }
    _concat(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesisExcluding(valueSource, params, '_concat') + ' || ' + this._appendValueParenthesisExcluding(value, params, columnType, typeAdapter, '_concat')
    }
    _substringToEnd(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'substr(' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    _power(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'power(' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    _logn(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'log(' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    _roundn(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'round(' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    _minValue(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'least(' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    _maxValue(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'greatest(' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    _add(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesisExcluding(valueSource, params, '_add') + ' + ' + this._appendValueParenthesisExcluding(value, params, columnType, typeAdapter, '_add')
    }
    _substract(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesisExcluding(valueSource, params, '_substract') + ' - ' + this._appendValueParenthesisExcluding(value, params, columnType, typeAdapter, '_substract')
    }
    _multiply(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesisExcluding(valueSource, params, '_multiply') + ' * ' + this._appendValueParenthesisExcluding(value, params, columnType, typeAdapter, '_multiply')
    }
    _divide(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'cast(' + this._appendSql(valueSource, params) + ' as double presition) / cast(' + this._appendValue(value, params, columnType, typeAdapter) + ' as double presition)'
    }
    _mod(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params) + ' % ' + this._appendValueParenthesis(value, params, columnType, typeAdapter)
    }
    _atan2(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'atan2(' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ')'
    }
    // SqlFunction2
    _substring(params: any[], valueSource: ToSql, value: any, value2: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'substr(' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ', ' + this._appendValue(value2, params, columnType, typeAdapter) + ')'
    }
    _replace(params: any[], valueSource: ToSql, value: any, value2: any, columnType: string, typeAdapter: TypeAdapter | undefined): string {
        return 'replace(' + this._appendSql(valueSource, params) + ', ' + this._appendValue(value, params, columnType, typeAdapter) + ', ' + this._appendValue(value2, params, columnType, typeAdapter) + ')'
    }
    _buildCallProcedure(params: any[], procedureName: string, procedureParams: ValueSource<any, any>[]): string {
        let result = 'call ' + this._escape(procedureName) + '('
        if (procedureParams.length > 0) {
            result += this._appendSql(procedureParams[0]!, params)

            for (let i = 1, length = procedureParams.length; i < length; i++) {
                result += ', ' + this._appendSql(procedureParams[i]!, params)
            }
        }

        return result + ')'
    }
    _buildCallFunction(params: any[], functionName: string, functionParams: ValueSource<any, any>[]): string {
        let result = 'select ' + this._escape(functionName) + '('
        if (functionParams.length > 0) {
            result += this._appendSql(functionParams[0]!, params)

            for (let i = 1, length = functionParams.length; i < length; i++) {
                result += ', ' + this._appendSql(functionParams[i]!, params)
            }
        }

        return result + ')'
    }
    _fragment(params: any[], sql: TemplateStringsArray, sqlParams: ValueSource<any, any>[]): string {
        if (sqlParams.length <= 0) {
            return sql[0]!
        }
        let result = ''
        for (let i = 0, length = sqlParams.length; i < length; i++) {
            result += sql[i]
            result += this._appendConditionSql(sqlParams[i]!, params)
        }
        result += sql[sql.length - 1]
        return result
    }
    _countAll(_params: any[]): string {
        return 'count(*)'
    }
    _count(params: any[], value: any): string {
        return 'count(' + this._appendSql(value, params) + ')'
    }
    _countDistinct(params: any[], value: any): string {
        return 'count(distinct ' + this._appendSql(value, params) + ')'
    }
    _max(params: any[], value: any): string {
        return 'max(' + this._appendSql(value, params) + ')'
    }
    _min(params: any[], value: any): string {
        return 'min(' + this._appendSql(value, params) + ')'
    }
    _sum(params: any[], value: any): string {
        return 'sum(' + this._appendSql(value, params) + ')'
    }
    _sumDistinct(params: any[], value: any): string {
        return 'sum(distinct ' + this._appendSql(value, params) + ')'
    }
    _average(params: any[], value: any): string {
        return 'avg(' + this._appendSql(value, params) + ')'
    }
    _averageDistinct(params: any[], value: any): string {
        return 'avg(distinct ' + this._appendSql(value, params) + ')'
    }
    _stringConcat(params: any[], separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'string_concat(' + this._appendSql(value, params) + ')'
        } else if (separator === '') {
            return 'string_concat(' + this._appendSql(value, params) + ", '')"
        } else {
            return 'string_concat(' + this._appendSql(value, params) + ', ' + this._appendValue(separator, params, 'string', undefined) + ')'
        }
    }
    _stringConcatDistinct(params: any[], separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'string_concat(distinct ' + this._appendSql(value, params) + ')'
        } else if (separator === '') {
            return 'string_concat(distinct ' + this._appendSql(value, params) + ", '')"
        } else {
            return 'string_concat(distinct ' + this._appendSql(value, params) + ', ' + this._appendValue(separator, params, 'string', undefined) + ')'
        }
    }
}
