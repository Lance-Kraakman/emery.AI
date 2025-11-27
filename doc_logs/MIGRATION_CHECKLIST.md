# Repository Migration Checklist

Quick reference for systematic repository pattern migration.

## Pre-Migration Phase

### ✅ Foundation (Completed)
- [x] Clean architecture directory structure
- [x] Dependency injection container
- [x] Organization repository (reference implementation)
- [x] Test infrastructure with real migration files
- [x] 48 tests passing baseline

## Per-Repository Migration Steps

### 1. **Domain Layer** (`lib/domain/`)
- [ ] Create entity interface matching database schema exactly
- [ ] Create `CreateXData` interface for business operations
- [ ] Create `UpdateXData` interface (usually `Partial<CreateXData>`)
- [ ] Define repository interface with business methods
- [ ] Add domain constants/enums if needed

### 2. **Infrastructure Layer** (`lib/infrastructure/db/repositories/`)
- [ ] Implement repository interface with Drizzle ORM
- [ ] Handle complex business logic (transactions, cascading operations)
- [ ] Proper error handling with descriptive messages
- [ ] Field mapping for database vs domain model differences

### 3. **Application Layer** (`lib/application/di/`)
- [ ] Register repository in DI container
- [ ] Update container type registry
- [ ] Add convenience getter function
- [ ] Test DI integration

### 4. **Testing** (`__tests__/lib/repositories/`)
- [ ] Comprehensive unit tests (15+ tests minimum)
- [ ] Test all repository interface methods
- [ ] Test complex business operations
- [ ] Test error conditions and edge cases
- [ ] Integration tests for Server Action flow

### 5. **Server Actions Migration** (`app/actions/`)
- [ ] Import repository from DI container
- [ ] Replace direct database calls with repository methods
- [ ] Simplify business logic (should be 50%+ reduction)
- [ ] Update imports from domain entities
- [ ] Maintain exact same API contract

### 6. **Type Cleanup** (`app/actions/types.ts`)
- [ ] Remove duplicated types now in domain entities
- [ ] Add comment showing where type moved
- [ ] Update imports in affected files
- [ ] Run tests to verify no breaking changes

## Quality Gates

### Before Each Migration
- [ ] All existing tests pass
- [ ] Performance baseline established
- [ ] Rollback strategy defined

### After Each Migration  
- [ ] All tests still pass
- [ ] New repository tests added and passing
- [ ] Integration tests verify end-to-end flow
- [ ] Performance maintained or improved
- [ ] Code coverage maintained above 90%

## Template Files

Use Organization repository as reference:
- **Entity**: `lib/domain/entities/organization.ts`
- **Repository Interface**: `lib/domain/repositories/organization-repository.ts`  
- **Implementation**: `lib/infrastructure/db/repositories/drizzle-organization-repository.ts`
- **Tests**: `__tests__/lib/repositories/organization-repository.test.ts`
- **Integration**: `__tests__/integration/server-action-integration.test.ts`

## Migration Order (Priority)

1. **Users** - Authentication foundation
2. **Roles** - Permission system  
3. **Agents** - Complex business logic
4. **Dynamic Tables** - Most complex (dual schema)
5. **Teams** - Lower priority
6. **Other entities** - As needed

## Common Patterns

### Repository Method Naming
- `findById()`, `findByX()` - Query operations
- `create()`, `update()`, `delete()` - Basic CRUD
- `addX()`, `removeX()` - Relationship management
- Business operations use descriptive names (`createWithOwner()`)

### Error Handling
```typescript
if (!result) {
  throw new Error(`Entity with id ${id} not found`);
}
```

### Transaction Usage
```typescript
return await this.db.transaction(async (tx) => {
  // Multiple related operations
});
```

### DI Registration
```typescript
this.repositories.set('IEntityRepository', 
  new DrizzleEntityRepository(db, rawClient));
```

## Success Indicators

- [ ] Server Actions simplified (fewer lines, clearer intent)
- [ ] Business logic centralized in repositories
- [ ] Easy to add new operations
- [ ] Comprehensive test coverage
- [ ] Type safety throughout
- [ ] No performance degradation
- [ ] Clear separation of concerns

## Quick Commands

```bash
# Run all tests
pnpm test:run

# Run specific repository tests  
pnpm test:run __tests__/lib/repositories/entity-repository.test.ts

# Run integration tests
pnpm test:run __tests__/integration/

# Check test coverage
pnpm test:coverage
```