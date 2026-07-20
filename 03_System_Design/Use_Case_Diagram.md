# Use Case Diagram

```mermaid
usecaseDiagram
    actor Operator as "Municipal Operator"
    actor Driver as "Truck Driver"
    actor Maintenance as "Maintenance Worker"
    
    usecase U1 as "View City Map"
    usecase U2 as "Monitor Bin Fill Levels"
    usecase U3 as "View Optimized Routes"
    usecase U4 as "Dispatch Truck"
    usecase U5 as "Report Bin Damage"
    usecase U6 as "Resolve Maintenance Alert"
    
    Operator --> U1
    Operator --> U2
    Operator --> U3
    Operator --> U4
    
    Driver --> U3
    Driver --> U5
    
    Maintenance --> U1
    Maintenance --> U6
```
