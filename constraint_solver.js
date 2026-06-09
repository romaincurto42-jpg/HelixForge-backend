function solveConstraints(constraints, shapes) {
    // boucle simple pour commencer
    for (let i = 0; i < 50; i++) {
        for (const c of constraints) {
            applyConstraint(c, shapes);
        }
    }
    return shapes;
}
