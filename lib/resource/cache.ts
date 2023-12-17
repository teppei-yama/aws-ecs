import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import {Construct} from 'constructs';


interface CacheSettings {
  cacheSecurityGroupName: string;
  cacheSecurityGroupDescription: string,
  cacheSubnetGroupName: string; 
  cacheSubnetGroupDescription: string,
  subnet: string[];
  cacheName: string;  
  cacheNodeType: string;
  engine: string;
  engineVersion: string;
  numCacheNodes: number;
  clusterName: string;
  port: number;
  removalPolicy: string; 
  snapshotRetentionLimit: number;
  snapshotName: string;
  snapshotWindow: string;
  transitEncryptionEnabled: boolean;
}

export class CacheStack extends Construct {
  public readonly cacheCluster: elasticache.CfnCacheCluster;
  public readonly caccheSecurityGroupId: string;
  private subid: { [key: string]: any };
  private _vpc: ec2.Vpc;
  
  constructor(scope: Construct, id: string, vpc: ec2.Vpc, subnetId: { [key: string]: ec2.SubnetAttributes }) {
    super(scope, id);
    this._vpc = vpc;
    this.subid = subnetId;

    const cacheSettings = scope.node.tryGetContext('cacheSettings') as CacheSettings;
    const subnetIds: string[] = cacheSettings.subnet.map(subnetName => {
      const attributes = this.subid[subnetName];
      const selectedSubnet: ec2.ISubnet = ec2.Subnet.fromSubnetAttributes(this, `Subnet-${subnetName}`, attributes);
      return selectedSubnet.subnetId;
  });
  const removalPolicySetting = cacheSettings.removalPolicy || 'RETAIN';
  const removalPolicy = removalPolicySetting === 'DESTROY' ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN;
    

    const CacheSecurityGroup = new ec2.SecurityGroup(this, cacheSettings.cacheSecurityGroupName, {
      vpc: this._vpc,
      description: cacheSettings.cacheSecurityGroupDescription,
      allowAllOutbound: true,
    });
    CacheSecurityGroup.addIngressRule(ec2.Peer.ipv4(this._vpc.vpcCidrBlock), ec2.Port.tcp(cacheSettings.port), 'Allow inbound TCP traffic on port 6379');

    this.caccheSecurityGroupId = CacheSecurityGroup.securityGroupId;

    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, cacheSettings.cacheSubnetGroupName, {
      description: cacheSettings.cacheSubnetGroupDescription,
      subnetIds: subnetIds,
    });

    // Create CacheCluster
    this.cacheCluster = new elasticache.CfnCacheCluster(this, cacheSettings.cacheName, {
      cacheNodeType: cacheSettings.cacheNodeType,
      engine: cacheSettings.engine,
      engineVersion: cacheSettings.engineVersion,
      numCacheNodes: cacheSettings.numCacheNodes,
      clusterName: cacheSettings.clusterName,
      port: cacheSettings.port,
      vpcSecurityGroupIds: [CacheSecurityGroup.securityGroupId],
      cacheSubnetGroupName: redisSubnetGroup.ref,
      snapshotRetentionLimit: cacheSettings.snapshotRetentionLimit,
      // snapshotName:cacheSettings.snapshotName, 
      // snapshotWindow: cacheSettings.snapshotWindow,           
      // transitEncryptionEnabled: cacheSettings.transitEncryptionEnabled,
    });
    this.cacheCluster.applyRemovalPolicy(removalPolicy)
  }
}

