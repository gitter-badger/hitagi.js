// Powered by https://github.com/RoganMurley/hitagi.js
(function () {
    "use strict";

    var levelWidth = window.innerWidth;
    var levelHeight = window.innerHeight;

    // Setup pixi.
    var stage = new PIXI.Container();
    var renderer = PIXI.autoDetectRenderer(levelWidth, levelHeight);
    document.body.appendChild(renderer.view);

    // Setup world.
    var world = new hitagi.World();

    // Setup rooms.
    var rooms = new hitagi.Rooms(world);

    // Define systems.
    var controlsSystem = world.register(new hitagi.systems.ControlsSystem());
    controlsSystem.bind(82, 'reload');

    controlsSystem.bind(32, 'jump');

    controlsSystem.bind(37, 'left');
    controlsSystem.bind(39, 'right');
    controlsSystem.bind(38, 'up');
    controlsSystem.bind(40, 'down');

    controlsSystem.bind('m1', 'spawn');

    // We need to update horizontal and vertical velocity seperately for our collision resolution technique.
    // The default hitagi VelocitySystem doesn't support this, but it's easy to make our own.
    var HorizontalVelocitySystem = function () {
        this.update = {
            velocity: function (entity, dt) {
                entity.c.position.x += hitagi.utils.delta(entity.c.velocity.xspeed, dt);
            }
        };
    };

    var VerticalVelocitySystem = function () {
        this.update = {
            velocity: function (entity, dt) {
                entity.c.position.y += hitagi.utils.delta(entity.c.velocity.yspeed, dt);
            }
        };
    };

    var PlayerControlsSystem = function (controlsSystem) {
        var moveSpeed = 200;

        this.update = {
            player: function (entity) {
                // Horizontal movement.
                if (controlsSystem.check('left')) {
                    entity.c.velocity.xspeed = -moveSpeed;
                }
                else if (controlsSystem.check('right')) {
                    entity.c.velocity.xspeed = moveSpeed;
                } else {
                    entity.c.velocity.xspeed = 0;
                }

                if (controlsSystem.check('jump')) {
                    if (entity.c.gravity.grounded > 4) {
                        entity.c.velocity.yspeed = -600;
                    }
                }
            }
        };
    };

    var GravitySystem = function (collisionSystem) {
        this.update = {
            gravity: function (entity, dt) {
                if (entity.c.velocity.yspeed < 1000) {
                    entity.c.velocity.yspeed += 35;
                }

                var test = collisionSystem.collide(entity, 'solid'),
                    x = entity.c.position.x,
                    y = entity.c.position.y;

                if (!test.length) {
                    test = collisionSystem.collide(entity, 'solid', {y: y + 1});
                    if (test.length) {
                        entity.c.velocity.yspeed = 0;
                        entity.c.gravity.grounded++;
                    } else {
                        entity.c.gravity.grounded = 0;
                    }

                    test = collisionSystem.collide(entity, 'solid', {y: y - 1});
                    if (test.length) {
                        entity.c.velocity.yspeed = Math.abs(entity.c.velocity.yspeed*0.3);
                    }
                }
            }
        };
    };

    var HorizontalBodySystem = function () {
        this.update = {
            body: function (entity, dt) {
                var test = collisionSystem.collide(entity, 'solid');
                if (test.length) {
                    var potentialResolutions = _.map(
                        test,
                        function (hitEntity) {
                            return collisionSystem.resolutionVector(entity, hitEntity).x;
                        }
                    );
                    var maxResolution = _.max(potentialResolutions, Math.abs);

                    entity.c.position.x += maxResolution;
                }
            }
        };
    };

    var VerticalBodySystem = function () {
        this.update = {
            body: function (entity, dt) {
                var test = collisionSystem.collide(entity, 'solid');
                if (test.length) {
                    var potentialResolutions = _.map(
                        test,
                        function (hitEntity) {
                            return collisionSystem.resolutionVector(entity, hitEntity).y;
                        }
                    );
                    var maxResolution = _.max(potentialResolutions, Math.abs);

                    entity.c.position.y += maxResolution;
                }
            }
        };
    };

    var SpawnSystem = function (world, controlsSystem, collisionSystem) {
        var dragging = false;
        var mousePos = controlsSystem.getMousePos();

        this.$tracking = {
            dragBoxUI: 'single'
        };

        this.tickStart = function () {
            mousePos = controlsSystem.getMousePos();

            if (!dragging && controlsSystem.check('spawn')) {
                world.add(
                    new hitagi.Entity()
                        .attach(new hitagi.components.Position({
                            x: mousePos.x,
                            y: mousePos.y
                        }))
                        .attach(new hitagi.components.graphics.Graphic({
                            alpha: 0.7,
                            anchor: {
                                x: 0,
                                y: 0
                            },
                            z: 100
                        }))
                        .attach(new hitagi.components.graphics.Rectangle({
                            width: 0,
                            height: 0,
                            color: 0xc9283e,
                        }))
                        .attach(new hitagi.components.Collision({
                            width: 0,
                            height: 0,
                            anchor: {
                                x: 0,
                                y: 0
                            }
                        }))
                        .attach({
                            $id: 'dragBoxUI',
                            width: 0,
                            height: 0,
                            origin: {
                                x: mousePos.x,
                                y: mousePos.y
                            }
                        })
                );
            }

            if (dragging && !controlsSystem.check('spawn')) {
                var box = this.$tracked.dragBoxUI;

                var x = box.c.position.x;
                var y = box.c.position.y;
                var width = box.c.dragBoxUI.width;
                var height = box.c.dragBoxUI.height;

                if (width < 0) {
                    width = Math.abs(width);
                    x -= width;
                }

                if (height < 0) {
                    height = Math.abs(height);
                    y -= height;
                }

                box.c.collision.width = width;
                box.c.collision.height = height;

                var test = collisionSystem.collide(box, 'player', {x: x, y: y});
                if (!test.length) {
                    var newBlock = world.add(
                        new Block({
                            x: x,
                            y: y,
                            width: width,
                            height: height,
                            anchor: {
                                x: 0,
                                y: 0
                            }
                        }
                    ));
                }

                world.remove(box);
            }

            dragging = controlsSystem.check('spawn');
        };

        this.update = {
            dragBoxUI: function (entity) {
                // Get box dimensions.
               entity.c.dragBoxUI.width = mousePos.x - entity.c.dragBoxUI.origin.x;
               entity.c.dragBoxUI.height = mousePos.y - entity.c.dragBoxUI.origin.y;

                // Update graphic.
                entity.c.rectangle.width = entity.c.dragBoxUI.width;
                entity.c.rectangle.height = entity.c.dragBoxUI.height;
            }
        };
    };

    // Create systems.
    var renderSystem = new hitagi.systems.PixiRenderSystem(stage);
    var soundSystem = new hitagi.systems.SoundSystem();
    var collisionSystem = new hitagi.systems.CollisionSystem();
    var horizontalVelocitySystem = new HorizontalVelocitySystem();
    var verticalVelocitySystem = new VerticalVelocitySystem();
    var playerControlsSystem = new PlayerControlsSystem(controlsSystem);
    var horizontalBodySystem = new HorizontalBodySystem();
    var verticalBodySystem = new VerticalBodySystem();
    var gravitySystem = new GravitySystem(collisionSystem);
    var spawnSystem = new SpawnSystem(world, controlsSystem, collisionSystem);

    // Register systems (order matters).
    world.register(renderSystem);
    world.register(soundSystem);
    world.register(collisionSystem);

    world.register(playerControlsSystem);
    world.register(spawnSystem);

    world.register(horizontalVelocitySystem);
    world.register(horizontalBodySystem);
    world.register(verticalVelocitySystem);
    world.register(verticalBodySystem);

    world.register(gravitySystem);

    // Define components.
    //'components';

    // Define entities.
    var Background = function (params) {
        return new hitagi.Entity()
            .attach(new hitagi.components.graphics.Graphic({
                anchor: {
                    x: 0,
                    y: 0
                },
                relative: false,
                z: -1000
            }))
            .attach(new hitagi.components.graphics.Rectangle({
                color: params.color,
                height: levelHeight,
                width: levelWidth
            }));
    };

    var Block = function (params) {
        params = _.extend({
            anchor: {
                x: 0.5,
                y: 0.5
            }
        }, params);

        return new hitagi.Entity()
            .attach(new hitagi.components.Position({
                x: params.x,
                y: params.y
            }))
            .attach(new hitagi.components.graphics.Graphic({
                anchor: params.anchor
            }))
            .attach(new hitagi.components.graphics.Rectangle({
                color: 0xf0433a,
                width: params.width,
                height: params.height
            }))
            .attach(new hitagi.components.Collision({
                width: params.width,
                height: params.height,
                anchor: params.anchor
            }))
            .attach({
                $id: 'block'
            })
            .attach({
                $id: 'solid'
            });
    };

    var Player = function (params) {
        return new hitagi.Entity()
            .attach(new hitagi.components.Position({
                x: params.x,
                y: params.y
            }))
            .attach (new hitagi.components.Velocity({
                xspeed: 0,
                yspeed: 0
            }))
            .attach(new hitagi.components.graphics.Graphic())
            .attach(new hitagi.components.graphics.Rectangle({
                color: 0xffffff,
                width: params.width,
                height: params.height
            }))
            .attach(new hitagi.components.Collision({
                width: params.width,
                height: params.height
            }))
            .attach({
                $id: 'player'
            })
            .attach({
                $id: 'body'
            })
            .attach({
                $id: 'gravity',
                grounded: 0
            });
    };

    // Load assets, then run game.
    //renderSystem.load([], main);
    main();

    function main () {
        // Create starting room.
        var startRoomEntities = [
            new Background({
                color: 0X2E112D
            }),
            new Player({
                height: 48,
                width: 32,
                x: levelWidth/2,
                y: levelHeight/2
            }),
            new Block({
                height: 32,
                width: levelWidth,
                x: levelWidth/2,
                y: levelHeight - 16
            }),
            new Block({
                height: 32,
                width: levelWidth,
                x: levelWidth/2,
                y: 16
            }),
            new Block({
                height: levelHeight,
                width: 32,
                x: 16,
                y: levelHeight/2
            }),
            new Block({
                height: levelHeight,
                width: 32,
                x: levelWidth - 16,
                y: levelHeight/2
            }),
            new hitagi.Entity()
                .attach(new hitagi.components.graphics.Graphic({
                    relative: false,
                    translate: {
                        x: levelWidth/2,
                        y: levelHeight*0.2
                    },
                    z: -500
                }))
                .attach(new hitagi.components.graphics.Text({
                    copy: 'drag to spawn blocks',
                    style: {
                        font: '72px monospace',
                        fill: 0XC9283E
                    }
                }))
        ];

        startRoomEntities.push(
            new Block({
                height: 64,
                width: 200,
                x: levelWidth/2,
                y: levelHeight -202
            })
        );

        // Load starting room.
        rooms.saveRoom('start', startRoomEntities);
        rooms.loadRoom('start');

        // Setup game loop.
        requestAnimationFrame(animate);

        function animate() {
            // Update the world.
            world.tick(1000/60);

            // Render the world.
            renderer.render(stage);

            // Next frame.
            requestAnimationFrame(animate);
        }
}

} ());
