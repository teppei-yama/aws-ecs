import { Construct } from 'constructs';

interface VpcContext{
    project:string;
    cidr: string;
    natGateway:number;
    location:string;
    availbiltyZones:string[];
}
interface SubnetContext {
    cidr: number;
    public: {
      number: number;
      name: string[];
    };
    private: {
      number: number;
      name: string[];
    };
    Isolated: {
      number: number;
      name: string[];
    };
  }
 
export function arraysubnetId(scope:Construct,subnetIdspublic:String[],subnetprivate:String[],subnetisolated:String[],
  tablepublic:String[],tableprivate:String[],tableisolated:String[]){
    const vpcContext = scope.node.tryGetContext("Vpc") as VpcContext;
    const subnetContext = scope.node.tryGetContext("Subnet") as SubnetContext;
    const subnetIds: { [key: string]: { subnetId: any, routeTableId: any } } = {};
    let i=0;
    for (let name of subnetContext.public.name){
        for(let az of vpcContext.availbiltyZones){
            subnetIds[`${vpcContext.project}-${name}-${az}`]={subnetId:subnetIdspublic[i],routeTableId:tablepublic[i]};
            i++;
        }
    }
    i=0;
    for (let name of subnetContext.private.name){
        for(let az of vpcContext.availbiltyZones){
            subnetIds[`${vpcContext.project}-${name}-${az}`]={subnetId:subnetprivate[i],routeTableId:tableprivate[i]};
            i++;}
    }
    i=0;
    for (let name of subnetContext.Isolated.name){
        for(let az of vpcContext.availbiltyZones){
            subnetIds[`${vpcContext.project}-${name}-${az}`]={subnetId:subnetisolated[i],routeTableId:tableisolated[i]};
        i++;}
    }
    return subnetIds;
}