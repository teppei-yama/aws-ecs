import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

interface RdsSettings {
  subnet: string[];
  rdsSecurityGroupName: string;
  rdsSecurityGroupDescription: string;
  username: string;
  password: string;
  secretName: string;
  generateStringKey: string;
  rdsSubnetGroupName: string;
  rdsSubnetGroupDescription: string;
  rdsInstanceName: string;
  removalPolicy: string;
  engineType: string;  
  engineVersion: string;  
  instanceClass: string;
  instanceSize: string;
  port: number;
}

export class RdsStack extends Construct {
  public readonly rdsInstance: rds.DatabaseInstance;
  public readonly RdsSecurityGroupId: string;
  private _vpc: ec2.Vpc;
  private subid: { [key: string]: any };

  constructor(scope: Construct, id: string, vpc: ec2.Vpc, subnetId: { [key: string]: ec2.SubnetAttributes }) {
    super(scope, id);
    this._vpc = vpc;
    this.subid = subnetId;
    const rdsSettings = scope.node.tryGetContext('rdsSettings') as RdsSettings;

    // サブネットの情報を取得
    const subnets = rdsSettings.subnet.map(subnetName => {
      const attributes = this.subid[subnetName];
      return ec2.Subnet.fromSubnetAttributes(this, `Subnet-${subnetName}`, attributes);
    });

    const rdsSecurityGroup = new ec2.SecurityGroup(this, rdsSettings.rdsSecurityGroupName, {
      vpc: this._vpc,
      description: rdsSettings.rdsSecurityGroupDescription,
      allowAllOutbound: true,
    });
    rdsSecurityGroup.addIngressRule(ec2.Peer.ipv4(this._vpc.vpcCidrBlock), ec2.Port.tcp(rdsSettings.port), 'Allow inbound TCP traffic on port 3306');

    this.RdsSecurityGroupId = rdsSecurityGroup.securityGroupId;

    const username = rdsSettings.username;
    const password = rdsSettings.password;

    const secret = new secretsmanager.Secret(this, rdsSettings.secretName, {
    generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: username, password: password }),
        generateStringKey: rdsSettings.generateStringKey,
    },
    });

    const dbSubnetGroup = new rds.SubnetGroup(this, rdsSettings.rdsSubnetGroupName, {
      description: rdsSettings.rdsSubnetGroupDescription,
      vpc: this._vpc,
      vpcSubnets: {
        subnets: subnets,
      }
    });

    // エンジンの種類に応じてDatabaseClusterEngineを設定
    let engine;
    const rdsEngine = rdsSettings.engineType;
    const rdsEngineVersion = rdsSettings.engineVersion;
    if (rdsEngine === 'mysql') {
        const fullVersion = rdsEngineVersion;
        const majorVersion = rdsEngineVersion.split('.')[0];
        engine = rds.DatabaseInstanceEngine.mysql({ version: rds.MysqlEngineVersion.of(fullVersion, majorVersion) });
    } else if (rdsEngine === 'postgres') {
        const fullVersion = rdsEngineVersion;
        const majorVersion = rdsEngineVersion.split('.')[0];
        engine = rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.of(fullVersion, majorVersion) });
    } else {
        throw new Error(`Unsupported engine version: ${rdsSettings.engineVersion}`);
    }

    // インスタンスクラスの設定
    const instanceClassMap: { [id: string]: ec2.InstanceClass } = {
      M7G: ec2.InstanceClass.M7G,
      M6G: ec2.InstanceClass.M6G,
      M6GD: ec2.InstanceClass.M6GD,
      M6ID: ec2.InstanceClass.M6ID,
      M6I: ec2.InstanceClass.M6I,
      M5D: ec2.InstanceClass.M5D,
      M5: ec2.InstanceClass.M5,
      M4: ec2.InstanceClass.M4,
      M3: ec2.InstanceClass.M3,
      X2G: ec2.InstanceClass.X2G,
      X2IDN: ec2.InstanceClass.X2IDN,
      X2IEDN: ec2.InstanceClass.X2IEDN,
      R7G: ec2.InstanceClass.R7G,
      R6G: ec2.InstanceClass.R6G,
      R6GD: ec2.InstanceClass.R6GD,
      R6ID: ec2.InstanceClass.R6ID,
      R6I: ec2.InstanceClass.R6I,
      R5D: ec2.InstanceClass.R5D,
      T2: ec2.InstanceClass.T2,
    };

    let instanceClass = instanceClassMap[rdsSettings.instanceClass];

    if (!instanceClass) {
        throw new Error(`Unsupported instance class: ${rdsSettings.instanceClass}`);
    }

    // インスタンスサイズの設定
    const instanceSizeMap: { [id: string]: ec2.InstanceSize } = {
        MICRO: ec2.InstanceSize.MICRO,
        SMALL: ec2.InstanceSize.SMALL,
        MEDIUM: ec2.InstanceSize.MEDIUM,
        LARGE: ec2.InstanceSize.LARGE,
        XLARGE: ec2.InstanceSize.XLARGE,
        XLARGE2: ec2.InstanceSize.XLARGE2,
        XLARGE4: ec2.InstanceSize.XLARGE4,
        XLARGE8: ec2.InstanceSize.XLARGE8,
        XLARGE12: ec2.InstanceSize.XLARGE12,
        XLARGE16: ec2.InstanceSize.XLARGE16,
        XLARGE24: ec2.InstanceSize.XLARGE24,
        XLARGE32: ec2.InstanceSize.XLARGE32,
    };

    let instanceSize = instanceSizeMap[rdsSettings.instanceSize];

    if (!instanceSize) {
        throw new Error(`Unsupported instance size: ${rdsSettings.instanceSize}`);
    }
    // リムーバルポリシーの設定
    let removalPolicy;
    switch (rdsSettings.removalPolicy) {
    case 'DESTROY':
        removalPolicy = cdk.RemovalPolicy.DESTROY;
        break;
    case 'RETAIN':
        removalPolicy = cdk.RemovalPolicy.RETAIN;
        break;
    default:
        removalPolicy = cdk.RemovalPolicy.SNAPSHOT;
    }
    // Create Rds
    this.rdsInstance = new rds.DatabaseInstance(this, rdsSettings.rdsInstanceName, {
      engine: engine,
      instanceType: ec2.InstanceType.of(instanceClass, instanceSize),     
      vpc: this._vpc,
      vpcSubnets: { subnets: subnets },
      securityGroups: [rdsSecurityGroup],
      subnetGroup: dbSubnetGroup,
      port: rdsSettings.port,
      credentials: rds.Credentials.fromSecret(secret),
      removalPolicy: removalPolicy,
    });
  }
}
