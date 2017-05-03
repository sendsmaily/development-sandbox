import React from 'react';
import PropTypes from 'prop-types';


const CreateForm = ({ isSaving, handleSubmit }) => {
  let input;

  return (
    <form
      id="add-todo" onSubmit={(event) => {
        event.preventDefault();
        handleSubmit(input);
      }
    }>
      <input
        ref={(node) => { input = node; }}
        className={isSaving ? 'saving' : ''} />
    </form>);
};

CreateForm.propTypes = {
  isSaving: PropTypes.bool.isRequired,
  handleSubmit: PropTypes.func.isRequired,
};

export default CreateForm;
