import { Injectable, type Type } from '@nestjs/common';

import { type ObjectLiteral } from 'typeorm';

import { type ObjectRecord } from 'twenty-shared/types';

import { getWorkspaceAuthContext } from 'src/engine/core-modules/auth/storage/workspace-auth-context.storage';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { buildObjectIdByNameMaps } from 'src/engine/metadata-modules/flat-object-metadata/utils/build-object-id-by-name-maps.util';
import { ExecuteInWorkspaceContextOptions } from 'src/engine/twenty-orm/types/execute-in-workspace-context-options.type';
import { type WorkspaceTransactionScope } from 'src/engine/twenty-orm/types/workspace-transaction-scope.type';
import {
  type ORMWorkspaceContext,
  withWorkspaceContext,
} from 'src/engine/twenty-orm/storage/orm-workspace-context.storage';
import type { RolePermissionConfig } from 'src/engine/twenty-orm/types/role-permission-config';
import { WorkspaceDataSourceService } from 'src/engine/twenty-orm/datasource/workspace-data-source.service';
import { type WorkspaceRepository } from 'src/engine/twenty-orm/repository/workspace-repository';
import { type FlatRoleMaps } from 'src/engine/metadata-modules/flat-role/types/flat-role-maps.type';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { convertClassNameToObjectMetadataName } from 'src/engine/workspace-manager/utils/convert-class-to-object-metadata-name.util';

@Injectable()
export class WorkspaceOrmManager {
  constructor(
    private readonly workspaceCacheService: WorkspaceCacheService,
    private readonly workspaceDataSourceService: WorkspaceDataSourceService,
  ) {}

  getRepository<T extends ObjectLiteral = ObjectRecord>(
    workspaceEntity: Type<T>,
    permissionOptions?: RolePermissionConfig,
    repositoryOptions?: {
      useReplica?: boolean;
      shouldSkipEventEmission?: boolean;
    },
  ): WorkspaceRepository<T>;

  getRepository<T extends ObjectLiteral = ObjectRecord>(
    objectMetadataName: string,
    permissionOptions?: RolePermissionConfig,
    repositoryOptions?: {
      useReplica?: boolean;
      shouldSkipEventEmission?: boolean;
    },
  ): WorkspaceRepository<T>;

  getRepository<T extends ObjectLiteral = ObjectRecord>(
    workspaceEntityOrObjectMetadataName: Type<T> | string,
    permissionOptions?: RolePermissionConfig,
    repositoryOptions?: {
      useReplica?: boolean;
      shouldSkipEventEmission?: boolean;
    },
  ): WorkspaceRepository<T> {
    const objectMetadataName = this.resolveObjectMetadataName(
      workspaceEntityOrObjectMetadataName,
    );

    return this.workspaceDataSourceService
      .getDataSource({ useReplica: repositoryOptions?.useReplica ?? false })
      .getRepository<T>(objectMetadataName, permissionOptions, {
        shouldSkipEventEmission:
          repositoryOptions?.shouldSkipEventEmission ?? false,
      });
  }

  private resolveObjectMetadataName<T extends ObjectLiteral>(
    workspaceEntityOrObjectMetadataName: Type<T> | string,
  ): string {
    if (typeof workspaceEntityOrObjectMetadataName === 'string') {
      return workspaceEntityOrObjectMetadataName;
    }

    return convertClassNameToObjectMetadataName(
      workspaceEntityOrObjectMetadataName.name,
    );
  }

  async runInWorkspaceTransaction<T>(
    work: (transactionScope: WorkspaceTransactionScope) => Promise<T>,
  ): Promise<T> {
    return this.workspaceDataSourceService
      .getDataSource({ useReplica: false })
      .transaction(work);
  }

  async executeInWorkspaceContext<T>(
    fn: () => T | Promise<T>,
    authContext?: WorkspaceAuthContext,
    options?: ExecuteInWorkspaceContextOptions,
  ): Promise<T> {
    const resolvedAuthContext = authContext ?? getWorkspaceAuthContext();
    const context = options?.lite
      ? await this.loadLiteWorkspaceContext(resolvedAuthContext)
      : await this.loadWorkspaceContext(resolvedAuthContext);

    return withWorkspaceContext(context, fn);
  }

  private async loadWorkspaceContext(
    authContext: WorkspaceAuthContext,
  ): Promise<ORMWorkspaceContext> {
    const workspaceId = authContext.workspace.id;

    const {
      flatObjectMetadataMaps,
      flatFieldMetadataMapsOrm,
      flatIndexMaps,
      featureFlagsMap,
      rolesPermissions: permissionsPerRoleId,
      userWorkspaceRoleMap,
      apiKeyRoleMap,
      flatRowLevelPermissionPredicateMaps,
      flatRowLevelPermissionPredicateGroupMaps,
      flatRoleMaps,
    } = await this.workspaceCacheService.getOrRecompute(workspaceId, [
      'flatObjectMetadataMaps',
      'flatFieldMetadataMapsOrm',
      'flatIndexMaps',
      'featureFlagsMap',
      'rolesPermissions',
      'userWorkspaceRoleMap',
      'apiKeyRoleMap',
      'flatRowLevelPermissionPredicateMaps',
      'flatRowLevelPermissionPredicateGroupMaps',
      // CM-004: needed to translate per-workspace role ids into the stable
      // universal identifiers the La Vivenzia access policy is written against.
      'flatRoleMaps',
    ]);

    const { idByNameSingular: objectIdByNameSingular } =
      buildObjectIdByNameMaps(flatObjectMetadataMaps);

    return {
      authContext,
      flatObjectMetadataMaps,
      flatFieldMetadataMaps: flatFieldMetadataMapsOrm,
      flatIndexMaps,
      flatRowLevelPermissionPredicateMaps,
      flatRowLevelPermissionPredicateGroupMaps,
      objectIdByNameSingular,
      featureFlagsMap,
      permissionsPerRoleId,
      userWorkspaceRoleMap,
      apiKeyRoleMap,
      lvRoleUniversalIdentifierByRoleId:
        buildLvRoleUniversalIdentifierByRoleId(flatRoleMaps),
    };
  }

  private async loadLiteWorkspaceContext(
    authContext: WorkspaceAuthContext,
  ): Promise<ORMWorkspaceContext> {
    const workspaceId = authContext.workspace.id;

    const { flatObjectMetadataMaps, flatFieldMetadataMapsOrm } =
      await this.workspaceCacheService.getOrRecompute(workspaceId, [
        'flatObjectMetadataMaps',
        'flatFieldMetadataMapsOrm',
      ]);

    const { idByNameSingular: objectIdByNameSingular } =
      buildObjectIdByNameMaps(flatObjectMetadataMaps);

    return {
      authContext,
      flatObjectMetadataMaps,
      flatFieldMetadataMaps: flatFieldMetadataMapsOrm,
      flatIndexMaps: {
        byUniversalIdentifier: {},
        universalIdentifierById: {},
        universalIdentifiersByApplicationId: {},
      },
      flatRowLevelPermissionPredicateMaps: {
        byUniversalIdentifier: {},
        universalIdentifierById: {},
        universalIdentifiersByApplicationId: {},
      },
      flatRowLevelPermissionPredicateGroupMaps: {
        byUniversalIdentifier: {},
        universalIdentifierById: {},
        universalIdentifiersByApplicationId: {},
      },
      objectIdByNameSingular,
      featureFlagsMap: {} as ORMWorkspaceContext['featureFlagsMap'],
      permissionsPerRoleId: {},
      userWorkspaceRoleMap: {},
      apiKeyRoleMap: {},
      // The lite context resolves no roles and no object permissions at all,
      // so it is an internal/system path rather than a user-facing one. Left
      // empty to match the maps above.
      lvRoleUniversalIdentifierByRoleId: {},
    };
  }
}

/*
 * CM-004: per-workspace role id -> stable role universal identifier.
 *
 * The La Vivenzia access policy is written against universal identifiers
 * because a role's id differs between workspaces, while the universal
 * identifier declared by the application manifest does not.
 */
const buildLvRoleUniversalIdentifierByRoleId = (
  flatRoleMaps: FlatRoleMaps,
): Record<string, string> => {
  const byRoleId: Record<string, string> = {};

  for (const [universalIdentifier, flatRole] of Object.entries(
    flatRoleMaps.byUniversalIdentifier,
  )) {
    if (flatRole !== undefined) {
      byRoleId[flatRole.id] = universalIdentifier;
    }
  }

  return byRoleId;
};
