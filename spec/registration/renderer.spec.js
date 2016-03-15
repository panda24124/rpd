describe('registration: renderer', function() {

    describe('network (Rpd.renderNext)', function() {

        afterEach(function() {
            Rpd.stopRendering();
        });

        it('the inner function is called with target element', function() {
            var fooTargetsSpy = jasmine.createSpy('foo-target');

            Rpd.renderer('foo', function(patch) {
                return fooTargetsSpy;
            });

            var target = { };
            Rpd.renderNext('foo', target);

            Rpd.addPatch();

            expect(fooTargetsSpy).toHaveBeenCalledWith(target, undefined);
        });

        it('called once for every patch', function() {
            var fooRendererSpy = jasmine.createSpy('foo-renderer');

            Rpd.renderer('foo', fooRendererSpy);

            Rpd.renderNext('foo', {});

            var firstPatch = Rpd.addPatch();
            var secondPatch = Rpd.addPatch();

            expect(fooRendererSpy).toHaveBeenCalledTwice();
            expect(fooRendererSpy).toHaveBeenCalledWith(firstPatch);
            expect(fooRendererSpy).toHaveBeenCalledWith(secondPatch);
        });

        it('the inner function is called for every target element and passes configuration there', function() {
            var fooTargetsSpy = jasmine.createSpy('foo-target');

            Rpd.renderer('foo', function(patch) {
                return fooTargetsSpy;
            });

            var targetOne = { };
            var targetTwo = { };
            var conf = { };
            Rpd.renderNext('foo', [ targetOne, targetTwo ], conf);

            Rpd.addPatch();

            expect(fooTargetsSpy).toHaveBeenCalledWith(targetOne, conf);
            expect(fooTargetsSpy).toHaveBeenCalledWith(targetTwo, conf);
        });

        it('the inner function is called for every renderer and target', function() {
            var fooTargetsSpy = jasmine.createSpy('foo-target');
            var barTargetsSpy = jasmine.createSpy('bar-target');

            Rpd.renderer('foo', function(patch) { return fooTargetsSpy; });
            Rpd.renderer('bar', function(patch) { return barTargetsSpy; });

            var targetOne = { };
            var targetTwo = { };
            var conf = {};
            Rpd.renderNext([ 'foo', 'bar' ], [ targetOne, targetTwo ], conf);

            Rpd.addPatch();

            expect(fooTargetsSpy).toHaveBeenCalled();
            expect(barTargetsSpy).toHaveBeenCalledWith(targetOne, conf);
            expect(barTargetsSpy).toHaveBeenCalledWith(targetTwo, conf);
        });

        it('turning off is not required for two renderNext in sequence', function() {
            var fooTargetsSpy = jasmine.createSpy('foo-target');
            var barTargetsSpy = jasmine.createSpy('bar-target');

            Rpd.renderer('foo', function(patch) { return fooTargetsSpy; });
            Rpd.renderer('bar', function(patch) { return barTargetsSpy; });

            var targetOne = { };
            var targetTwo = { };
            var conf = {};

            Rpd.renderNext('foo', targetOne, conf);

            Rpd.addPatch();

            expect(fooTargetsSpy).toHaveBeenCalledOnce();
            fooTargetsSpy.calls.reset();

            Rpd.renderNext('bar', targetTwo, conf);

            Rpd.addPatch();

            expect(fooTargetsSpy).not.toHaveBeenCalled();
            expect(barTargetsSpy).toHaveBeenCalledOnce();
        });

        it('passes the events to the handler object', function() {
            var addNodeSpy = jasmine.createSpy('add-node');
            var addInletSpy = jasmine.createSpy('add-inlet');

            Rpd.renderer('foo', function(patch) {
                return function(target, conf) {
                    return { 'patch/add-node': addNodeSpy,
                             'node/add-inlet': addInletSpy }
                };
            });

            Rpd.renderNext('foo', {});

            var patch = Rpd.addPatch();
            var node = patch.addNode('spec/empty');
            var inlet = node.addInlet('spec/any', 'foo');

            expect(addNodeSpy).toHaveBeenCalledWith(jasmine.objectContaining({ node: node }));
            expect(addInletSpy).toHaveBeenCalledWith(jasmine.objectContaining({ inlet: inlet }));
        });

        it('do not caches the events happened before setting up a renderer', function() {

            var addNodeSpy  = jasmine.createSpy('add-node'),
                addInletSpy = jasmine.createSpy('add-inlet');

            var patch = Rpd.addPatch();
            var node = patch.addNode('spec/empty');
            var inlet = node.addInlet('spec/any', 'foo');

            Rpd.renderer('foo', function(patch) {
                return function(target, conf) {
                    return { 'patch/add-node': addNodeSpy,
                             'node/add-inlet': addInletSpy }
                };
            });

            Rpd.renderNext('foo', {});

            expect(addNodeSpy).not.toHaveBeenCalled();
            expect(addInletSpy).not.toHaveBeenCalled();

        });

        describe('subpatches and canvases', function() {

            function createCanvasMock(name) {
                return { name: name; }
            }

            function createRendererMock = function() {

                return (function() {

                    var patchToRoot = {};
                    var patchToCanvasName = {};
                    var numOfCanvases = 0;

                    return function(patch) {
                        return function(root, conf) {

                            patchToRoot[patch.id] = root;
                            var canvasName = conf.prefix + '-' + numOfCanvases + '-' + patch.name;
                            var canvas = createCanvasMock(canvasName);
                            patchToCanvasName[patch.id] = canvasName;
                            numOfCanvases++;
                            // TODO: patch.canvasSize

                            return {
                                'patch/select': function(update) {
                                    var previousPatch = update.previousPatch;
                                    var previousPatchRoot = patchToRoot[previousPatch.id];
                                    if ((previousPatchRoot == root) && update.doReplace) {
                                        delete root[canvasName];
                                    };
                                    root[canvasName] = canvas;
                                }
                            }
                        }
                    }

                })();

            };

            var rendererMock;

            beforeEach(function() {
                rendererMock = createRendererMock();
            });

            describe('single root', function() {

                it('allows to add all the patches canvases to this root', function() {
                    var root = {};

                    Rpd.renderer('mock', rendererMock);

                    Rpd.renderNext('mock', root, { prefix: 'all' });

                    Rpd.addPatch('first');

                    expect(root['all-0-first']).toBeDefined();

                    Rpd.addPatch('second');

                    expect(root['all-0-first']).toBeDefined();
                    expect(root['all-1-second']).toBeDefined();
                });

                it('by default, replaces corresponding canvas content when user selects subpatches', function() {
                    var root1 = {};
                    var root2 = {};

                    var canvas1 = {},
                        canvas2 = {};
                });

                it('with option `subpatchesInRoot` set to `true`, adds subpatch canvas content to the root', function() {
                    var root1 = {};
                    var root2 = {};

                    var canvas1 = {},
                        canvas2 = {};
                });

            });

            describe('several roots', function() {

                it('allows to add patches to a separate roots', function() {

                });

                it('by default, even with different roots, replaces corresponding canvas content when user selects subpatches', function() {
                    var root1 = {};
                    var root2 = {};

                    var canvas1 = {},
                        canvas2 = {};
                });

                it('with option `subpatchesInRoot` set to `true`, even with different roots, adds subpatch canvas content to the root', function() {
                    var root1 = {};
                    var root2 = {};

                    var canvas1 = {},
                        canvas2 = {};
                });

            });

        });

    });

    describe('patch (path.render)', function() {

        it('called once for every patch', function() {
            var fooRendererSpy = jasmine.createSpy('foo-renderer');

            Rpd.renderer('foo', fooRendererSpy);

            var firstPatch = Rpd.addPatch().render('foo', {});
            var secondPatch = Rpd.addPatch().render('foo', {});

            expect(fooRendererSpy).toHaveBeenCalledTwice();
            expect(fooRendererSpy).toHaveBeenCalledWith(firstPatch);
            expect(fooRendererSpy).toHaveBeenCalledWith(secondPatch);

            Rpd.stopRendering();
        });

        it('the inner function is called with target element', function() {
            var fooTargetsSpy = jasmine.createSpy('foo-target');

            Rpd.renderer('foo', function(patch) {
                return fooTargetsSpy;
            });

            var target = { };
            Rpd.addPatch().render('foo', target);

            expect(fooTargetsSpy).toHaveBeenCalledWith(target, undefined);
        });

        it('the inner function is called for every target element and passes configuration there', function() {
            var fooTargetsSpy = jasmine.createSpy('foo-target');

            Rpd.renderer('foo', function(patch) {
                return fooTargetsSpy;
            });

            var targetOne = { };
            var targetTwo = { };
            var conf = { };
            Rpd.addPatch().render('foo', [ targetOne, targetTwo ], conf);

            expect(fooTargetsSpy).toHaveBeenCalledWith(targetOne, conf);
            expect(fooTargetsSpy).toHaveBeenCalledWith(targetTwo, conf);
        });

        it('the inner function is called for every renderer and target', function() {
            var fooTargetsSpy = jasmine.createSpy('foo-target');
            var barTargetsSpy = jasmine.createSpy('bar-target');

            Rpd.renderer('foo', function(patch) { return fooTargetsSpy; });
            Rpd.renderer('bar', function(patch) { return barTargetsSpy; });

            var targetOne = { };
            var targetTwo = { };
            var conf = {};

            Rpd.addPatch().render([ 'foo', 'bar' ], [ targetOne, targetTwo ], conf);

            expect(fooTargetsSpy).toHaveBeenCalled();
            expect(barTargetsSpy).toHaveBeenCalledWith(targetOne, conf);
            expect(barTargetsSpy).toHaveBeenCalledWith(targetTwo, conf);
        });

        it('passes the events to the handler object', function() {
            var addNodeSpy = jasmine.createSpy('add-node');
            var addInletSpy = jasmine.createSpy('add-inlet');

            Rpd.renderer('foo', function(patch) {
                return function(target, conf) {
                    return { 'patch/add-node': addNodeSpy,
                             'node/add-inlet': addInletSpy }
                };
            });

            var patch = Rpd.addPatch().render('foo', {});
            var node = patch.addNode('spec/empty');
            var inlet = node.addInlet('spec/any', 'foo');

            expect(addNodeSpy).toHaveBeenCalledWith(jasmine.objectContaining({ node: node }));
            expect(addInletSpy).toHaveBeenCalledWith(jasmine.objectContaining({ inlet: inlet }));
        });

        it('provides events for all subscribed patches', function() {
            var addNodeSpy = jasmine.createSpy('add-node');
            var addInletSpy = jasmine.createSpy('add-inlet');

            Rpd.renderer('foo', function(patch) {
                return function(target, conf) {
                    return { 'patch/add-node': addNodeSpy }
                };
            });
            Rpd.renderer('bar', function(patch) {
                return function(target, conf) {
                    return { 'node/add-inlet': addInletSpy }
                };
            });

            var patchOne = Rpd.addPatch().render(['foo', 'bar'], {});
            var nodeOne = patchOne.addNode('spec/empty');
            var inletOne = nodeOne.addInlet('spec/any', 'foo');

            var patchTwo = Rpd.addPatch().render('bar', {});
            var nodeTwo = patchTwo.addNode('spec/empty');
            var inletTwo = nodeTwo.addInlet('spec/any', 'foo');

            expect(addNodeSpy).toHaveBeenCalledWith(jasmine.objectContaining({ node: nodeOne }));
            expect(addInletSpy).toHaveBeenCalledWith(jasmine.objectContaining({ inlet: inletOne }));
            expect(addInletSpy).toHaveBeenCalledWith(jasmine.objectContaining({ inlet: inletTwo }));
        });

        it('renderer could also return a function handling any event', function() {
            var fooEventSpy = jasmine.createSpy('foo-events');
            var barEventSpy = jasmine.createSpy('bar-events');

            Rpd.renderer('foo', function(patch) {
                return function(target, conf) {
                    return fooEventSpy;
                };
            });
            Rpd.renderer('bar', function(patch) {
                return function(target, conf) {
                    return barEventSpy;
                };
            });

            var patchOne = Rpd.addPatch().render(['foo', 'bar'], {});
            var nodeOne = patchOne.addNode('spec/empty');

            var patchTwo = Rpd.addPatch().render('bar', {});
            var nodeTwo = patchTwo.addNode('spec/empty');
            var inletTwo = nodeTwo.addInlet('spec/any', 'foo');

            expect(fooEventSpy).toHaveBeenCalledWith(jasmine.objectContaining({ type: 'patch/add-node', node: nodeOne }));
            expect(barEventSpy).toHaveBeenCalledWith(jasmine.objectContaining({ type: 'patch/add-node', node: nodeTwo }));
            expect(barEventSpy).toHaveBeenCalledWith(jasmine.objectContaining({ type: 'node/add-inlet', inlet: inletTwo }));
            expect(fooEventSpy).not.toHaveBeenCalledWith(jasmine.objectContaining({ type: 'patch/add-inlet', inlet: inletTwo }));
        });

        it('continues rendering patches with assigned configurations', function() {
            var fooAddNodeSpy = jasmine.createSpy('foo-add-node');
            var fooAddInletSpy = jasmine.createSpy('foo-add-inlet');
            var barAddNodeSpy = jasmine.createSpy('bar-add-node');
            var barAddInletSpy = jasmine.createSpy('bar-add-inlet');

            Rpd.renderer('foo', function(patch) {
                return function(target, conf) {
                    return { 'patch/add-node': fooAddNodeSpy,
                             'node/add-inlet': fooAddInletSpy }
                };
            });

            Rpd.renderer('bar', function(patch) {
                return function(target, conf) {
                    return { 'patch/add-node': barAddNodeSpy,
                             'node/add-inlet': barAddInletSpy }
                };
            });

            var patchOne = Rpd.addPatch().render('foo', {});
            var nodeOne = patchOne.addNode('spec/empty');

            expect(fooAddNodeSpy).toHaveBeenCalledWith(jasmine.objectContaining({ node: nodeOne, patch: patchOne }));
            expect(barAddNodeSpy).not.toHaveBeenCalled();
            fooAddNodeSpy.calls.reset();

            var patchTwo = Rpd.addPatch().render('bar', {});
            var nodeTwo = patchTwo.addNode('spec/empty');

            expect(fooAddNodeSpy).not.toHaveBeenCalled();
            expect(barAddNodeSpy).toHaveBeenCalledWith(jasmine.objectContaining({ node: nodeTwo, patch: patchTwo }));

            var inletOne = nodeOne.addInlet('spec/any', 'foo');

            expect(fooAddInletSpy).toHaveBeenCalledWith(jasmine.objectContaining({ inlet: inletOne, node: nodeOne }));
            expect(barAddInletSpy).not.toHaveBeenCalled();
            fooAddInletSpy.calls.reset();

            var inletTwo = nodeTwo.addInlet('spec/any', 'bar');

            expect(fooAddInletSpy).not.toHaveBeenCalled();
            expect(barAddInletSpy).toHaveBeenCalledWith(jasmine.objectContaining({ inlet: inletTwo, node: nodeTwo }));
        });

        it('caches the events happened before setting up a renderer and passses them later', function() {

            var addNodeSpy  = jasmine.createSpy('add-node'),
                addInletSpy = jasmine.createSpy('add-inlet');

            var patch = Rpd.addPatch();
            var node = patch.addNode('spec/empty');
            var inlet = node.addInlet('spec/any', 'foo');

            Rpd.renderer('foo', function(patch) {
                return function(target, conf) {
                    return { 'patch/add-node': addNodeSpy,
                             'node/add-inlet': addInletSpy }
                };
            });

            expect(addNodeSpy).not.toHaveBeenCalled();
            expect(addInletSpy).not.toHaveBeenCalled();

            patch.render('foo', {});

            expect(addNodeSpy).toHaveBeenCalledWith(jasmine.objectContaining({ patch: patch, node: node }));
            expect(addInletSpy).toHaveBeenCalledWith(jasmine.objectContaining({ node: node, inlet: inlet }));

        });

        describe('subpatches and canvases', function() {

            describe('single root', function() {

                it('allows to add all the patches canvases to this root', function() {
                    var patchRenderSpy = jasmine.createSpy('patch-render');

                    var root = {};

                    var canvas1 = {},
                        canvas2 = {};

                    Rpd.renderer('foo', {
                        addTo: function(root, patch) {
                            if (patch.name == 'one') root['canvas-1'] = canvas1;
                            if (patch.name == 'two') root['canvas-2'] = canvas2;
                        },
                        render: patchRenderSpy.and.callFake(function(patch, conf) {

                        })
                    });

                    Rpd.

                    var patchOne = Rpd.addPatch().render(root);

                    expect(patchRenderSpy.toHaveBeenCalledWith(patchOne));

                    var patchTwo = Rpd.addPatch().render(root);

                    expect(patchRenderSpy.toHaveBeenCalledWith(patchTwo));
                    expect(root['canvas-1']).toBe(canvas1);
                    expect(root['canvas-2']).toBe(canvas2);
                });

                it('by default, replaces corresponding canvas content when user selects subpatches', function() {
                    var root1 = {};
                    var root2 = {};

                    var canvas1 = {},
                        canvas2 = {};
                });

                it('with option `subpatchesInRoot` set to `true`, adds subpatch canvas content to the root', function() {
                    var root1 = {};
                    var root2 = {};

                    var canvas1 = {},
                        canvas2 = {};
                });

                it('respects option `subpatchesInRoot` set for paticular patch and its subpatches', function() {
                    var root1 = {};
                    var root2 = {};

                    var canvas1 = {},
                        canvas2 = {};
                });

            });

            describe('several roots', function() {

                it('allows to add patches to a separate roots', function() {

                });

                it('by default, even with different roots, replaces corresponding canvas content when user selects subpatches', function() {
                    var root1 = {};
                    var root2 = {};

                    var canvas1 = {},
                        canvas2 = {};


                });

                it('with option `subpatchesInRoot` set to `true`, even with different roots, adds subpatch canvas content to the root', function() {
                    var root1 = {};
                    var root2 = {};

                    var canvas1 = {},
                        canvas2 = {};
                });

                it('subpatches inherit their parents\' root configiration', function() {

                });

                it('respects option `subpatchesInRoot` set for paticular patch and its subpatches', function() {
                    var root1 = {};
                    var root2 = {};

                    var canvas1 = {},
                        canvas2 = {};
                });

            });

        });

    });

});
