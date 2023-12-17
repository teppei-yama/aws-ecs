import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Vpc } from './resource/vpc_subnet';
import {arraysubnetId} from './resource/subnetId';
import { RdsStack } from './resource/rds';
import { CacheStack } from './resource/cache';
import { EcsStack } from './resource/service';

export class mainStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
      super(scope, id, props);
      const vpc = new Vpc();
      const vpcResource = vpc.createResources(this);
      const subnetIdspublic = vpc.vpc.publicSubnets.map(subnet => subnet.subnetId);
      const subnetprivate = vpc.vpc.privateSubnets.map(subnet => subnet.subnetId);
      const subnetisolated = vpc.vpc.isolatedSubnets.map(subnet => subnet.subnetId);
      const tablepublic =vpc.vpc.publicSubnets.map(subnet=>subnet.routeTable.routeTableId);
      const tableprivate =vpc.vpc.privateSubnets.map(subnet=>subnet.routeTable.routeTableId);
      const tableisolated =vpc.vpc.isolatedSubnets.map(subnet=>subnet.routeTable.routeTableId);
      const subnetID = arraysubnetId(scope,subnetIdspublic,subnetprivate,subnetisolated,tablepublic,tableprivate,tableisolated);
      const rdsStack = new RdsStack(this, 'RdsStack', vpcResource, subnetID);
      const cacheStack = new CacheStack(this, 'CacheStack', vpcResource, subnetID);
      const rds = rdsStack.rdsInstance;
      const rdsSgId = rdsStack.RdsSecurityGroupId;
      const cache = cacheStack.cacheCluster;
      const caccheSgId = cacheStack.caccheSecurityGroupId
      new EcsStack(this, 'EcsStack', vpcResource, subnetID, rds, rdsSgId, cache, caccheSgId);
    }
  }
