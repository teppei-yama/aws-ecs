import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';

interface Service1Settings {
  clusterName: string;
  subnet:string[];
  ecsTaskExecutionRoleName: string;  
  iamActions: string[];               
  iamResources: string[];
  eceSecurityGroupName: string;
  eceSecurityGroupDescription: string;
  FargateServiceName: string;
  cpu: number;
  memory: number;
  desiredCounts: number;
  containerImage: string;
  containerName: string;
  containerPort: number;
  publicLoadBalancer: boolean;
  mixCapacity: number;
  maxCapacity: number; 
  targetUtilizationPercent: number;  
  scaleInCooldown: number;
  scaleOutCooldown: number;
  healthCheckPath: string;
  timeout: number;
  healthyThresholdCount: number;
  interval: number;
}
interface Service2Settings {
  subnet:string[];
  eceSecurityGroupName: string;
  eceSecurityGroupDescription: string;
  FargateServiceName: string;
  cpu: number;
  memory: number;
  desiredCounts: number;
  containerImage: string;
  containerName: string;
  containerPort: number;
  publicLoadBalancer: boolean;
  mixCapacity: number;
  maxCapacity: number; 
  targetUtilizationPercent: number;  
  scaleInCooldown: number;
  scaleOutCooldown: number;
  healthCheckPath: string;
  timeout: number;
  healthyThresholdCount: number;
  interval: number;
}
interface PortSettings{
  inboundFromNet: number;
  outboundServiceFromPort: number;
  outboundServiceToPort: number;
  inboundServiceFromPort: number;
  inboundServiceToPort: number;
}
interface RdsSettings {
  port: number;
}
interface CacheSettings {
  port: number;
}

export class EcsStack extends Construct {
  private _vpc: ec2.Vpc;
  private subid: { [key: string]: any };
  constructor(scope: Construct, id: string, vpc: ec2.Vpc, subnetId: { [key: string]: ec2.SubnetAttributes }, rds: rds.DatabaseInstance, rdsSgId: string, cache: elasticache.CfnCacheCluster, cacheSgId: string) {
    super(scope, id);
    this._vpc = vpc;
    this.subid = subnetId;
    const service1Setting = scope.node.tryGetContext('service1') as Service1Settings;
    const service2Setting = scope.node.tryGetContext('service2') as Service2Settings;
    const PortSettings = scope.node.tryGetContext('securityPort') as PortSettings;
    const rdsSettings = scope.node.tryGetContext('rdsSettings') as RdsSettings;
    const cacheSettings = scope.node.tryGetContext('cacheSettings') as CacheSettings;
    const cluster = new ecs.Cluster(this, service1Setting.clusterName, {
      vpc: this._vpc,
    });

    // サブネットの情報を取得
    const subnet1 = service1Setting.subnet.map(subnetName => {
      const attributes = this.subid[subnetName];
      return ec2.Subnet.fromSubnetAttributes(this, `Subnet-${subnetName}`, attributes);
    });

    const subnet2 = service2Setting.subnet.map(subnetName => {
      const attributes = this.subid[subnetName];
      return ec2.Subnet.fromSubnetAttributes(this, `Subnet-${subnetName}`, attributes);
    });

    const ecsTaskExecutionRole = new iam.Role(this, service1Setting.ecsTaskExecutionRoleName, {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    ecsTaskExecutionRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'));
    ecsTaskExecutionRole.addToPolicy(new iam.PolicyStatement({
      resources: service1Setting.iamResources,
      actions: service1Setting.iamActions,
    }));
    ecsTaskExecutionRole.addToPolicy(new iam.PolicyStatement({
      resources: [rds.instanceArn],
      actions: [
        'secretsmanager:GetSecretValue',
        'kms:Decrypt',
      ],
    }));

    const ecsSecurityGroup1 = new ec2.SecurityGroup(this, service1Setting.eceSecurityGroupName, {
      vpc: this._vpc,
      description: service1Setting.eceSecurityGroupDescription,
      allowAllOutbound: false,
    });
    
    const ecsSecurityGroup2 = new ec2.SecurityGroup(this, service2Setting.eceSecurityGroupName, {
      vpc: this._vpc,
      description: service2Setting.eceSecurityGroupDescription,
      allowAllOutbound: false,
    });
    
    // サービス1のセキュリティグループ
    new ec2.CfnSecurityGroupIngress(this, 'Service1IngressFromInternet', {
      groupId: ecsSecurityGroup1.securityGroupId,
      ipProtocol: 'tcp',
      cidrIp: '0.0.0.0/0',
      fromPort: PortSettings.inboundFromNet,
      toPort: PortSettings.inboundFromNet,
      description: 'Allow inbound TCP traffic on port 80 from the internet'
    });

    new ec2.CfnSecurityGroupEgress(this, 'Service1EgressToRDS', {
      groupId: ecsSecurityGroup1.securityGroupId,
      ipProtocol: 'tcp',
      destinationSecurityGroupId: rdsSgId,
      fromPort: rdsSettings.port,
      toPort: rdsSettings.port,
      description: 'Allow outbound TCP traffic to RDS'
    });

    new ec2.CfnSecurityGroupEgress(this, 'Service1EgressToCache', {
      groupId: ecsSecurityGroup1.securityGroupId,
      ipProtocol: 'tcp',
      destinationSecurityGroupId: cacheSgId,
      fromPort: cacheSettings.port,
      toPort: cacheSettings.port,
      description: 'Allow outbound TCP traffic to Cache'
    });

    new ec2.CfnSecurityGroupEgress(this, 'Service1EgressToDocker', {
      groupId: ecsSecurityGroup1.securityGroupId,
      ipProtocol: 'tcp',
      cidrIp: '0.0.0.0/0',
      fromPort: 443,
      toPort: 443,
      description: 'Allow outbound TCP traffic on port 443 to Docker Hub'
    });

    // サービス2のセキュリティグループ
    new ec2.CfnSecurityGroupIngress(this, 'Service2IngressFromInternet', {
      groupId: ecsSecurityGroup2.securityGroupId,
      ipProtocol: 'tcp',
      cidrIp: '0.0.0.0/0',
      fromPort: PortSettings.inboundFromNet,
      toPort: PortSettings.inboundFromNet,
      description: 'Allow inbound TCP traffic from the internet'
    });

    new ec2.CfnSecurityGroupIngress(this, 'Service2IngressFromService1', {
      groupId: ecsSecurityGroup2.securityGroupId,
      ipProtocol: 'tcp',
      sourceSecurityGroupId: ecsSecurityGroup1.securityGroupId,
      fromPort: PortSettings.inboundServiceFromPort,
      toPort: PortSettings.inboundServiceToPort,
      description: 'Allow inbound TCP traffic from service1'
    });

    new ec2.CfnSecurityGroupEgress(this, 'Service2EgressToDocker', {
      groupId: ecsSecurityGroup2.securityGroupId,
      ipProtocol: 'tcp',
      cidrIp: '0.0.0.0/0',
      fromPort: 443,
      toPort: 443,
      description: 'Allow outbound TCP traffic on port 443 to Docker Hub'
    });

    new ec2.CfnSecurityGroupEgress(this, 'Service2EgressToService1', {
      groupId: ecsSecurityGroup2.securityGroupId,
      ipProtocol: 'tcp',
      destinationSecurityGroupId: ecsSecurityGroup1.securityGroupId,
      fromPort: PortSettings.outboundServiceFromPort,
      toPort: PortSettings.outboundServiceToPort,
      description: 'Allow outbound TCP traffic to Service1'
    });

    const rdsInstance = rds
    const redisCluster = cache;

    //  Create FargateService1
    const fargateService1 = new ecs_patterns.ApplicationLoadBalancedFargateService(this, service1Setting.FargateServiceName, {
      cluster: cluster, 
      cpu: service1Setting.cpu, 
      memoryLimitMiB: service1Setting.memory,
      desiredCount: service1Setting.desiredCounts,
      taskSubnets: {
        subnets: subnet1
      }, 
      taskImageOptions: { 
        image: ecs.ContainerImage.fromRegistry(service1Setting.containerImage),
        environment: { 
          'DB_HOST': rdsInstance.dbInstanceEndpointAddress,
          'DB_PORT': rdsInstance.dbInstanceEndpointPort,
          'DB_CREDENTIALS_SECRET_NAME': rdsInstance.secret?.secretName || '',
          'REDIS_HOST': redisCluster.attrRedisEndpointAddress,
          'REDIS_PORT': redisCluster.attrRedisEndpointPort
        },
        containerName: service1Setting.containerName,
        containerPort: service1Setting.containerPort,
        executionRole: ecsTaskExecutionRole,
      },    
      publicLoadBalancer: service1Setting.publicLoadBalancer,
      securityGroups: [ecsSecurityGroup1],
    });
    // サービスのAutoScalingグループを取得
    const scaling1 = fargateService1.service.autoScaleTaskCount({
      minCapacity: service1Setting.mixCapacity,
      maxCapacity: service1Setting.maxCapacity
    });

    // ターゲットCPU使用率を指定してスケーリングポリシーを追加
    scaling1.scaleOnCpuUtilization('service1CpuScaling', {
      targetUtilizationPercent: service1Setting.targetUtilizationPercent,
      scaleInCooldown: cdk.Duration.seconds(service1Setting.scaleInCooldown),
      scaleOutCooldown: cdk.Duration.seconds(service1Setting.scaleOutCooldown)
    });
    fargateService1.targetGroup.configureHealthCheck({
      path: service1Setting.healthCheckPath,
      timeout:Duration.seconds(service1Setting.timeout),
      healthyThresholdCount: service1Setting.healthyThresholdCount, 
      interval: Duration.seconds(service1Setting.interval), 
    });
    
    // Create FargateService2
    const fargateService2 = new ecs_patterns.ApplicationLoadBalancedFargateService(this, service2Setting.FargateServiceName, {
      cluster: cluster, 
      cpu: service2Setting.cpu, 
      memoryLimitMiB: service2Setting.memory,
      desiredCount: service2Setting.desiredCounts,
      taskSubnets: {
        subnets: subnet2
      }, 
      taskImageOptions: { 
        image: ecs.ContainerImage.fromRegistry(service2Setting.containerImage),
        containerName: service2Setting.containerName,
        containerPort: service2Setting.containerPort,
      },    
      publicLoadBalancer: service2Setting.publicLoadBalancer,
      securityGroups: [ecsSecurityGroup2],
    });
    // サービスのAutoScalingグループを取得
    const scaling2 = fargateService2.service.autoScaleTaskCount({
      minCapacity: service2Setting.mixCapacity,
      maxCapacity: service2Setting.maxCapacity
    });

    // ターゲットCPU使用率を指定してスケーリングポリシーを追加
    scaling2.scaleOnCpuUtilization('service2CpuScaling', {
      targetUtilizationPercent: service2Setting.targetUtilizationPercent,
      scaleInCooldown: cdk.Duration.seconds(service2Setting.scaleInCooldown),
      scaleOutCooldown: cdk.Duration.seconds(service2Setting.scaleOutCooldown)
    });
    fargateService2.targetGroup.configureHealthCheck({
      path: service2Setting.healthCheckPath,
      timeout:Duration.seconds(service2Setting.timeout),
      healthyThresholdCount: service2Setting.healthyThresholdCount, 
      interval: Duration.seconds(service2Setting.interval), 
    });
    fargateService2.node.addDependency(fargateService1);
  }
}


