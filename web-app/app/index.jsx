import React from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';

import './styles/styles.scss';

import TodoList from './components/TodoList';
import CreateForm from './components/CreateForm';

// Set up default axios base URL.
axios.defaults.baseURL = 'http://api.development.sandbox';

class App extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      items: [],
      isSaving: false,
    };

    // This binding is necessary to make `this` work in the callback
    this.submitTodoItem = this.submitTodoItem.bind(this);
    this.flipTodoItem = this.flipTodoItem.bind(this);
  }

  componentDidMount() {
    this.fetchTodoItems();
  }

  fetchTodoItems() {
    axios.get('/tasks')
      .then((result) => {
        this.setState(Object.assign({}, this.state, { items: result.data }));
      });
  }

  submitTodoItem(input) {
    // Short circuit when the input is empty.
    if (!input.value.trim()) return;

    this.setState({ isSaving: true });

    axios.post('/tasks', { body: input.value.trim() })
      .then((result) => {
        const items = this.state.items;
        // We're reassigning the input element to avoid
        // "Assignment to property of function parameter 'input'  no-param-reassign"
        const inputElement = input;
        items.push(result.data);
        this.setState(Object.assign({}, this.state, { items, isSaving: false }));
        inputElement.value = '';
      })
      .catch((error) => {
        alert(`Error saving the item. ${error}`);
      });
  }

  flipTodoItem(item) {
    axios.put(`/tasks/${item.uuid}`, {
      body: item.body,
      is_done: !item.is_done,
      created_at: item.created_at,
    })
      .then(() => {
        const items = this.state.items;
        items.forEach((item_) => {
          if (item_.uuid !== item.uuid) return;
          Object.assign(item_, item, { is_done: !item.is_done });
        });
        this.setState(Object.assign({}, this.state, { items }));
      })
      .catch((error) => {
        alert(`Error marking item done. ${error}`);
      });
  }

  render() {
    return (
      <div>
        <h1>The todo:</h1>
        <TodoList items={this.state.items} flipTodoItem={this.flipTodoItem} />
        <CreateForm handleSubmit={this.submitTodoItem} isSaving={this.state.isSaving} />
      </div>
    );
  }
}

ReactDOM.render(<App />, document.getElementById('root'));
