import { registerDecorator, ValidationOptions } from 'class-validator';

export function NoSpaces(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'noSpaces',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && !/\s/g.test(value);
        },
      },
    });
  };
}
